import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const allowedOrigins = new Set((Deno.env.get('STREAMBOXX_ALLOWED_ORIGINS') ?? '')
  .split(',').map((origin) => origin.trim()).filter(Boolean));

const jsonHeaders = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

function reply(status: number, body: Record<string, unknown>, origin?: string) {
  const headers = new Headers(jsonHeaders);
  if (origin && allowedOrigins.has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') ?? undefined;
  if (origin && !allowedOrigins.has(origin)) {
    return reply(403, { error: 'This app origin is not allowed.' });
  }
  if (request.method === 'OPTIONS') {
    const response = reply(204, {}, origin);
    response.headers.set('access-control-allow-methods', 'POST, OPTIONS');
    response.headers.set('access-control-allow-headers', 'authorization, apikey, content-type, x-client-info');
    response.headers.set('access-control-max-age', '600');
    return response;
  }
  if (request.method !== 'POST') return reply(405, { error: 'Use POST to request playback.' }, origin);
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    return reply(503, { error: 'Playback is not configured yet.' }, origin);
  }

  const authorization = request.headers.get('authorization');
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return reply(401, { error: 'Sign in before requesting playback.' }, origin);

  let body: unknown;
  try { body = await request.json(); } catch { return reply(400, { error: 'A title ID is required.' }, origin); }
  const titleId = typeof body === 'object' && body !== null && 'titleId' in body
    ? (body as { titleId?: unknown }).titleId : undefined;
  if (typeof titleId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(titleId)) {
    return reply(400, { error: 'A valid title ID is required.' }, origin);
  }

  try {
    const viewerClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });
    const { data: userData, error: authError } = await viewerClient.auth.getUser(bearer);
    if (authError || !userData.user) return reply(401, { error: 'Your sign-in has expired. Sign in again.' }, origin);

    const { data: hasAccess, error: accessError } = await viewerClient.rpc('has_streamboxx_access');
    if (accessError) return reply(503, { error: 'Member access could not be checked. Please try again.' }, origin);
    if (hasAccess !== true) return reply(402, { error: 'Your free trial or daily pass has ended.' }, origin);

    const ownerClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const now = new Date().toISOString();
    const { data: title, error: titleError } = await ownerClient.from('streamboxx_public_titles')
      .select('id').eq('id', titleId).not('published_at', 'is', null).lte('published_at', now).maybeSingle();
    if (titleError) return reply(503, { error: 'The catalogue could not be checked. Please try again.' }, origin);
    if (!title) return reply(404, { error: 'This title is not currently available.' }, origin);

    const { data: assets, error: assetError } = await ownerClient.from('media_assets')
      .select('id,provider,provider_asset_id').eq('title_id', titleId).eq('status', 'ready')
      .lte('ready_at', now).order('ready_at', { ascending: false }).limit(8);
    if (assetError) return reply(503, { error: 'The media service could not be checked. Please try again.' }, origin);
    if (!assets?.length) return reply(404, { error: 'A playable version is not available yet.' }, origin);

    const playbackSources: Array<{ label: string; provider: string; playbackUrl: string; expiresInSeconds: number }> = [];
    for (const asset of assets) {
      if (asset.provider === 'cloudflare_stream') {
      const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID');
      const apiToken = Deno.env.get('CLOUDFLARE_STREAM_API_TOKEN');
      const customerCode = Deno.env.get('CLOUDFLARE_STREAM_CUSTOMER_CODE');
      if (!accountId || !apiToken || !customerCode || !/^[a-z0-9-]+$/i.test(customerCode)) {
        continue;
      }
      const videoResponse = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(asset.provider_asset_id)}`, {
        headers: { authorization: `Bearer ${apiToken}` }, signal: AbortSignal.timeout(12000),
      });
      const videoResult = await videoResponse.json().catch(() => ({}));
      if (!videoResponse.ok || videoResult?.result?.uid !== asset.provider_asset_id) {
        continue;
      }
      if (videoResult.result.requireSignedURLs !== true || videoResult.result.readyToStream !== true || videoResult.result.status?.state !== 'ready') {
        await ownerClient.from('media_assets').update({ status: 'unavailable', ready_at: null })
          .eq('title_id', titleId).eq('provider', 'cloudflare_stream').eq('provider_asset_id', asset.provider_asset_id);
        continue;
      }
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/stream/${encodeURIComponent(asset.provider_asset_id)}/token`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 * 60 }),
        signal: AbortSignal.timeout(12000),
      });
      const tokenResult = await response.json().catch(() => ({}));
      const signedToken = tokenResult?.result?.token;
      if (response.ok && typeof signedToken === 'string') {
        playbackSources.push({
          label: `Server ${playbackSources.length + 1}`,
          provider: asset.provider,
          playbackUrl: `https://customer-${customerCode}.cloudflarestream.com/${signedToken}/manifest/video.m3u8`,
          expiresInSeconds: 60 * 60,
        });
      }
      continue;
    }

    if (asset.provider === 'supabase_storage') {
      if (/\.(mp4|m4v|webm)$/i.test(asset.provider_asset_id)) {
        const { data: signed, error: signingError } = await ownerClient.storage
          .from('streamboxx-media').createSignedUrl(asset.provider_asset_id, 90 * 60);
        if (!signingError && signed?.signedUrl) playbackSources.push({
          label: `Server ${playbackSources.length + 1}`,
          provider: asset.provider,
          playbackUrl: signed.signedUrl,
          expiresInSeconds: 90 * 60,
        });
      }
    }
    }
    if (!playbackSources.length) return reply(503, { error: 'No secure playback server is available for this title right now.' }, origin);
    return reply(200, { playbackUrl: playbackSources[0].playbackUrl, playbackSources, expiresInSeconds: playbackSources[0].expiresInSeconds }, origin);
  } catch {
    return reply(500, { error: 'Playback could not be started. Please try again.' }, origin);
  }
});
