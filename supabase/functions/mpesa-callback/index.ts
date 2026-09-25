import { createClient } from 'npm:@supabase/supabase-js@2';

const projectUrl = Deno.env.get('SUPABASE_URL');
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const mode = Deno.env.get('MPESA_ENVIRONMENT') === 'production' ? 'production' : 'sandbox';
const root = mode === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});

function sameSecret(actual: string, expected: string) {
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index++) difference |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return difference === 0;
}

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(405, { ResultCode: 1, ResultDesc: 'POST required' });
  const callbackSecret = Deno.env.get('MPESA_CALLBACK_SECRET');
  const suppliedSecret = new URL(request.url).searchParams.get('token') ?? '';
  if (!callbackSecret || !sameSecret(suppliedSecret, callbackSecret)) return reply(404, { ResultCode: 1, ResultDesc: 'Callback not found' });
  if (!projectUrl || !serviceKey) return reply(503, { ResultCode: 1, ResultDesc: 'Payment service unavailable' });
  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > 65536) return reply(413, { ResultCode: 1, ResultDesc: 'Callback too large' });

  let payload: Record<string, unknown>;
  try { payload = await request.json(); } catch { return reply(400, { ResultCode: 1, ResultDesc: 'Invalid callback' }); }
  const body = payload?.Body as Record<string, unknown> | undefined;
  const callback = body?.stkCallback as Record<string, unknown> | undefined;
  const checkoutId = callback?.CheckoutRequestID;
  if (typeof checkoutId !== 'string') {
    return reply(200, { ResultCode: 0, ResultDesc: 'Callback received' });
  }
  if (callback?.ResultCode !== 0) {
    const ownerClient = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    await ownerClient.from('daily_passes').update({ status: 'failed' })
      .eq('provider_checkout_id', checkoutId).eq('status', 'pending');
    return reply(200, { ResultCode: 0, ResultDesc: 'Payment cancellation received' });
  }

  try {
    const shortcode = Deno.env.get('MPESA_SHORTCODE');
    const passkey = Deno.env.get('MPESA_PASSKEY');
    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY');
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET');
    if (!shortcode || !passkey || !consumerKey || !consumerSecret) return reply(503, { ResultCode: 1, ResultDesc: 'Payment service unavailable' });

    const tokenResponse = await fetch(`${root}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` }, signal: AbortSignal.timeout(12000),
    });
    const tokenBody = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || typeof tokenBody.access_token !== 'string') return reply(503, { ResultCode: 1, ResultDesc: 'Payment verification unavailable' });

    const time = timestamp();
    const password = btoa(`${shortcode}${passkey}${time}`);
    const queryResponse = await fetch(`${root}/mpesa/stkpushquery/v1/query`, {
      method: 'POST', headers: { authorization: `Bearer ${tokenBody.access_token}`, 'content-type': 'application/json' },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ BusinessShortCode: shortcode, Password: password, Timestamp: time, CheckoutRequestID: checkoutId }),
    });
    const query = await queryResponse.json().catch(() => ({}));
    if (!queryResponse.ok || query.CheckoutRequestID !== checkoutId || String(query.ResultCode) !== '0') {
      return reply(200, { ResultCode: 0, ResultDesc: 'Payment confirmation is not available yet' });
    }

    const metadata = (callback.CallbackMetadata as { Item?: Array<{ Name?: string; Value?: unknown }> } | undefined)?.Item ?? [];
    const value = (name: string) => metadata.find((item) => item.Name === name)?.Value;
    const receipt = value('MpesaReceiptNumber');
    const amountValue = value('Amount');
    const amount = typeof amountValue === 'number' ? amountValue : Number(amountValue);
    if (typeof receipt !== 'string' || !Number.isFinite(amount)) return reply(200, { ResultCode: 0, ResultDesc: 'Payment details are incomplete' });

    const ownerClient = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: outcome, error } = await ownerClient.rpc('complete_streamboxx_mpesa_pass', {
      p_checkout_request_id: checkoutId,
      p_receipt: receipt,
      p_amount: amount,
    });
    if (error || !['completed', 'already_completed'].includes(String(outcome))) {
      return reply(200, { ResultCode: 0, ResultDesc: 'Payment received; account update is under review' });
    }
    return reply(200, { ResultCode: 0, ResultDesc: 'Payment confirmed' });
  } catch {
    return reply(503, { ResultCode: 1, ResultDesc: 'Payment confirmation could not be completed' });
  }
});
