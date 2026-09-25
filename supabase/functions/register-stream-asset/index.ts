import { createClient } from 'npm:@supabase/supabase-js@2';

const projectUrl = Deno.env.get('SUPABASE_URL');
const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
const apiToken = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');
const allowedOrigins = new Set((Deno.env.get('STREAMBOXX_ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean));

function reply(status: number, body: Record<string, unknown>, origin?: string) {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  if (origin && allowedOrigins.has(origin)) { headers.set('access-control-allow-origin', origin); headers.set('vary', 'Origin'); }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? undefined;
  if (origin && !allowedOrigins.has(origin)) return reply(403, { error: 'This app origin is not allowed.' });
  if (request.method === 'OPTIONS') {
    const response = reply(204, {}, origin);
    response.headers.set('access-control-allow-methods', 'POST, OPTIONS');
    response.headers.set('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info');
    response.headers.set('access-control-max-age', '600');
    return response;
  }
  if (request.method !== 'POST') return reply(405, { error: 'Use POST to register a media asset.' }, origin);
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return reply(401, { error: 'Sign in as the StreamBoXx owner.' }, origin);
  if (!projectUrl || !publicKey || !serviceKey || !accountId || !apiToken) {
    return reply(503, { error: 'The streaming provider is not configured yet.' }, origin);
  }

  let payload: unknown;
  try { payload = await request.json(); } catch { return reply(400, { error: 'Enter the title and Cloudflare video ID.' }, origin); }
  const titleId = typeof payload === 'object' && payload !== null && 'titleId' in payload ? (payload as { titleId?: unknown }).titleId : undefined;
  const videoId = typeof payload === 'object' && payload !== null && 'videoId' in payload ? (payload as { videoId?: unknown }).videoId : undefined;
  if (typeof titleId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(titleId)
      || typeof videoId !== 'string' || !/^[a-z0-9_-]{12,80}$/i.test(videoId)) {
    return reply(400, { error: 'Enter a valid title and Cloudflare video ID.' }, origin);
  }

  try {
    const viewerClient = createClient(projectUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await viewerClient.auth.getUser(bearer);
    if (authError || !userData.user) return reply(401, { error: 'Your sign-in has expired. Sign in again.' }, origin);
    const { data: isOwner, error: ownerError } = await viewerClient.rpc('is_streamboxx_owner');
    if (ownerError || isOwner !== true) return reply(403, { error: 'Only the StreamBoXx owner can register media.' }, origin);

    const ownerClient = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: title, error: titleError } = await ownerClient.from('titles').select('id,artwork_path')
      .eq('id', titleId).maybeSingle();
    if (titleError || !title) return reply(404, { error: 'The selected title could not be found.' }, origin);
    const { data: rights, error: rightsError } = await ownerClient.from('catalog_rights')
      .select('rights_reference,artwork_rights_reference,rights_cleared_at').eq('title_id', titleId).maybeSingle();
    if (rightsError) return reply(503, { error: 'Title rights could not be checked.' }, origin);
    if (!rights?.rights_cleared_at || !rights.rights_reference?.trim()
        || (title.artwork_path && !rights.artwork_rights_reference?.trim())) {
      return reply(409, { error: 'Record and clear title and poster rights before adding streaming media.' }, origin);
    }

    const apiResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(videoId)}`, {
      headers: { authorization: `Bearer ${apiToken}` }, signal: AbortSignal.timeout(12000),
    });
    const result = await apiResponse.json().catch(() => ({}));
    const asset = result?.result;
    if (!apiResponse.ok || asset?.uid !== videoId) return reply(404, { error: 'Cloudflare could not find that video in the configured account.' }, origin);
    const { data: existing, error: existingError } = await ownerClient.from('media_assets').select('id,title_id')
      .eq('provider', 'cloudflare_stream').eq('provider_asset_id', videoId).maybeSingle();
    if (existingError) return reply(503, { error: 'Media inventory could not be checked.' }, origin);
    if (existing && existing.title_id !== titleId) return reply(409, { error: 'This Cloudflare video is already assigned to another title.' }, origin);

    if (asset.requireSignedURLs !== true || asset.status?.state === 'error') {
      if (existing) await ownerClient.from('media_assets').update({ status: 'unavailable', ready_at: null }).eq('id', existing.id);
      return asset.requireSignedURLs !== true
        ? reply(409, { error: 'Enable Require Signed URLs for this video in Cloudflare, then sync it again.' }, origin)
        : reply(422, { error: 'Cloudflare could not process this video. Fix or replace it before syncing.' }, origin);
    }

    const isReady = asset.readyToStream === true && asset.status?.state === 'ready';
    const row = {
      title_id: titleId,
      provider: 'cloudflare_stream',
      provider_asset_id: videoId,
      status: isReady ? 'ready' : 'processing',
      ready_at: isReady ? (asset.readyToStreamAt ?? new Date().toISOString()) : null,
      duration_seconds: Number.isFinite(asset.duration) && asset.duration > 0 ? Math.ceil(asset.duration) : null,
    };
    const { error: saveError } = existing
      ? await ownerClient.from('media_assets').update(row).eq('id', existing.id)
      : await ownerClient.from('media_assets').insert(row);
    if (saveError) return reply(503, { error: 'The verified video could not be saved to the catalogue.' }, origin);
    return reply(200, { status: isReady ? 'ready' : 'processing', message: isReady ? 'Signed Cloudflare video linked and ready.' : 'Cloudflare is still processing this video. Sync again when it is ready.' }, origin);
  } catch {
    return reply(503, { error: 'The streaming provider could not be checked. Please try again.' }, origin);
  }
});
