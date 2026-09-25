import { createClient } from 'npm:@supabase/supabase-js@2';

const projectUrl = Deno.env.get('SUPABASE_URL');
const publicKey = Deno.env.get('SUPABASE_ANON_KEY');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const providerMode = Deno.env.get('MPESA_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
const paymentProduct = Deno.env.get('MPESA_PRODUCT') ?? 'paybill';
const transactionType = paymentProduct === 'buygoods' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline';
const providerRoot = providerMode === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
const allowedOrigins = new Set((Deno.env.get('STREAMBOXX_ALLOWED_ORIGINS') ?? '').split(',').map((value) => value.trim()).filter(Boolean));
const reply = (status: number, body: Record<string, unknown>, origin?: string) => {
  const headers = new Headers({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  if (origin && allowedOrigins.has(origin)) { headers.set('access-control-allow-origin', origin); headers.set('vary', 'Origin'); }
  return new Response(JSON.stringify(body), { status, headers });
};

function normalizeKenyanPhone(value: unknown) {
  if (typeof value !== 'string') return null;
  const digits = value.trim().replace(/[\s()-]/g, '').replace(/^\+/, '');
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  return null;
}

function darajaTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

async function getDarajaToken(key: string, secret: string) {
  const basic = btoa(`${key}:${secret}`);
  const response = await fetch(`${providerRoot}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { authorization: `Basic ${basic}` }, signal: AbortSignal.timeout(12000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || typeof result.access_token !== 'string') throw new Error('M-Pesa authorization failed.');
  return result.access_token as string;
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
  if (request.method !== 'POST') return reply(405, { error: 'Use POST to start checkout.' }, origin);
  if (!['paybill', 'buygoods'].includes(paymentProduct)) return reply(503, { error: 'M-Pesa product configuration is invalid.' }, origin);
  if (Deno.env.get('MPESA_CHECKOUT_ENABLED') !== 'true') return reply(503, { error: 'M-Pesa checkout is disabled until deliberately enabled for testing.' }, origin);
  if (providerMode === 'production' && Deno.env.get('MPESA_LIVE_PAYMENTS_ENABLED') !== 'true') return reply(503, { error: 'Live payments are disabled until production approval and validation are complete.' }, origin);

  const auth = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!auth || !projectUrl || !publicKey || !serviceKey) return reply(401, { error: 'Sign in before starting checkout.' }, origin);
  const shortcode = Deno.env.get('MPESA_SHORTCODE');
  const partyB = paymentProduct === 'buygoods' ? Deno.env.get('MPESA_TILL_NUMBER') : shortcode;
  const passkey = Deno.env.get('MPESA_PASSKEY');
  const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
  const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
  const callbackUrl = Deno.env.get('MPESA_CALLBACK_URL');
  if (!shortcode || !partyB || !passkey || !consumerKey || !consumerSecret || !callbackUrl?.startsWith('https://')) {
    return reply(503, { error: 'Secure M-Pesa checkout is not configured yet.' }, origin);
  }

  let payload: unknown;
  try { payload = await request.json(); } catch { return reply(400, { error: 'Enter a valid Kenyan M-Pesa number.' }, origin); }
  const phone = typeof payload === 'object' && payload !== null && 'phone' in payload
    ? normalizeKenyanPhone((payload as { phone?: unknown }).phone) : null;
  if (!phone) return reply(400, { error: 'Enter a Kenyan mobile number such as 0712345678.' }, origin);

  try {
    const viewerClient = createClient(projectUrl, publicKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: userData, error: authError } = await viewerClient.auth.getUser(auth);
    if (authError || !userData.user) return reply(401, { error: 'Your sign-in has expired. Sign in again.' }, origin);

    const ownerClient = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile } = await ownerClient.from('profiles').select('account_status').eq('id', userData.user.id).maybeSingle();
    if (!profile || profile.account_status !== 'active') return reply(403, { error: 'This account cannot start a payment.' }, origin);
    const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: recentPending, error: pendingError } = await ownerClient.from('daily_passes').select('id')
      .eq('user_id', userData.user.id).eq('status', 'pending').gte('created_at', cutoff).limit(1).maybeSingle();
    if (pendingError) return reply(503, { error: 'Checkout could not be checked. Please try again.' }, origin);
    if (recentPending) return reply(429, { error: 'A payment prompt was just sent. Complete it on your phone before trying again.' }, origin);

    const { data: pass, error: createError } = await ownerClient.from('daily_passes').insert({
      user_id: userData.user.id, amount_kes: 50, status: 'pending', provider: 'mpesa',
    }).select('id').single();
    if (createError || !pass) return reply(503, { error: 'Checkout could not be created. Please try again.' }, origin);

    const token = await getDarajaToken(consumerKey, consumerSecret);
    const timestamp = darajaTimestamp();
    const password = btoa(`${shortcode}${passkey}${timestamp}`);
    const response = await fetch(`${providerRoot}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(18000),
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: transactionType,
        Amount: 50,
        PartyA: phone,
        PartyB: partyB,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: `SB${pass.id.replaceAll('-', '').slice(0, 10)}`,
        TransactionDesc: 'StreamBoXx day pass',
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ResponseCode !== '0' || typeof result.CheckoutRequestID !== 'string') {
      await ownerClient.from('daily_passes').update({ status: 'failed' }).eq('id', pass.id).eq('status', 'pending');
      return reply(502, { error: 'M-Pesa could not start the payment prompt. Please check the number and try again.' }, origin);
    }
    const { error: saveError } = await ownerClient.from('daily_passes').update({ provider_checkout_id: result.CheckoutRequestID })
      .eq('id', pass.id).eq('user_id', userData.user.id).eq('status', 'pending');
    if (saveError) return reply(503, { error: 'M-Pesa sent a prompt, but StreamBoXx could not save its reference. Contact support before paying again.' }, origin);
    return reply(200, { status: 'prompt_sent', message: 'Check your phone and approve the KES 50 M-Pesa prompt.', checkoutId: result.CheckoutRequestID }, origin);
  } catch {
    return reply(502, { error: 'M-Pesa could not be reached. No payment has been confirmed. Please try again shortly.' }, origin);
  }
});
