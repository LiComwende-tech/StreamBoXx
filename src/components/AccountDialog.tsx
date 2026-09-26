import { useEffect, useState, type FormEvent } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseConfigured } from '../lib/supabase';

const checkoutEnabled = import.meta.env.VITE_ENABLE_CHECKOUT === 'true';
const phoneTrialsEnabled = import.meta.env.VITE_ENABLE_PHONE_TRIALS === 'true';

type Profile = { trial_started_at: string | null; trial_ends_at: string | null; phone_number: string | null; account_status: 'active' | 'suspended' };

function toKenyanE164(value: string) {
  const digits = value.trim().replace(/[\s()-]/g, '').replace(/^\+/, '');
  if (/^0[17]\d{8}$/.test(digits)) return `+254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return `+${digits}`;
  return null;
}

export default function AccountDialog({ user, profile, isOwner, onClose, onOpenAdmin }: { user: User | null; profile: Profile | null; isOwner: boolean; onClose: () => void; onOpenAdmin: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [passEndsAt, setPassEndsAt] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPhone(user?.phone ?? profile?.phone_number ?? (typeof user?.user_metadata?.phone_number === 'string' ? user.user_metadata.phone_number : ''));
  }, [user?.id, user?.phone, profile?.phone_number]);

  useEffect(() => {
    if (!supabase || !user) { setPassEndsAt(null); return; }
    let active = true;
    void supabase.from('daily_passes').select('ends_at').eq('user_id', user.id).eq('status', 'paid')
      .gt('ends_at', new Date().toISOString()).order('ends_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (active) setPassEndsAt(data?.ends_at ?? null); });
    return () => { active = false; };
  }, [user?.id]);

  async function buyDayPass() {
    if (!supabase) return;
    setNotice('');
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('mpesa-checkout', { body: { phone } });
      if (error) {
        let explanation = error.message;
        if (error.context instanceof Response) {
          const body = await error.context.clone().json().catch(() => null);
          if (typeof body?.error === 'string') explanation = body.error;
        }
        throw new Error(explanation);
      }
      if (typeof data?.checkoutId !== 'string') throw new Error('M-Pesa did not return a payment reference.');
      setNotice('Payment prompt sent. Approve KES 50 on your phone; StreamBoXx will confirm it automatically.');
      for (let attempt = 0; attempt < 15; attempt++) {
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
        const { data: pass, error: lookupError } = await supabase.from('daily_passes').select('status,ends_at')
          .eq('user_id', user!.id).eq('provider_checkout_id', data.checkoutId).maybeSingle();
        if (lookupError) throw lookupError;
        if (pass?.status === 'paid' && pass.ends_at) {
          setPassEndsAt(pass.ends_at);
          setNotice(`Payment confirmed. Your day pass is active until ${new Date(pass.ends_at).toLocaleString()}.`);
          return;
        }
        if (pass?.status === 'failed' || pass?.status === 'reversed') {
          setNotice('M-Pesa did not complete this payment. You can try again.');
          return;
        }
      }
      setNotice('The payment is still pending. Keep this account; access will activate as soon as M-Pesa confirms the payment.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Checkout could not be started. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendPhoneCode() {
    if (!supabase || !user) return;
    const e164 = toKenyanE164(phone);
    if (!e164) { setNotice('Enter a Kenyan mobile number, such as 0712345678.'); return; }
    setBusy(true);
    setNotice('');
    const { error } = await supabase.auth.updateUser({ phone: e164 });
    setBusy(false);
    if (error) setNotice(error.message);
    else setNotice(`We sent a verification code to ${e164}. Enter it below to start your 48-hour trial.`);
  }

  async function verifyPhone() {
    if (!supabase || !user) return;
    const e164 = toKenyanE164(phone);
    if (!e164 || !/^\d{6}$/.test(verificationCode.trim())) { setNotice('Enter the six-digit code sent to your Kenyan number.'); return; }
    setBusy(true);
    setNotice('');
    const { error } = await supabase.auth.verifyOtp({ phone: e164, token: verificationCode.trim(), type: 'phone_change' });
    setBusy(false);
    if (error) setNotice(error.message);
    else { setVerificationCode(''); setNotice('Phone verified. Your 48-hour free trial is now active.'); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setNotice('');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        setNotice(data.session ? 'Your account is ready. Phone verification and the free trial will be available after SMS setup.' : 'Check your email to confirm your account, then sign in. Phone verification and the free trial will be available after SMS setup.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setNotice('You are signed in.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'We could not complete that request. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) setNotice(error.message);
    else setNotice('You are signed out.');
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
        <button className="dialog-close" onClick={onClose} aria-label="Close account">×</button>
        <p className="eyebrow">STREAMBOXX ACCOUNT</p>
        <h2 id="account-title">{user ? 'Your account' : mode === 'signup' ? 'Join StreamBoXx' : 'Welcome back'}</h2>

        {!supabaseConfigured ? (
          <div className="demo-notice">Account services are temporarily unavailable. Please try again later.</div>
        ) : user ? (
          <div className="account-signed-in">
            <p className="account-email">{user.email}</p>
            {isOwner ? <p className="account-owner-note">Owner account · you don’t need a viewer day pass.</p> : <>
              {profile ? <p>{profile.account_status === 'suspended' ? 'This account is suspended. Contact the StreamBoXx owner for help.' : profile.trial_ends_at ? `Your 48-hour trial ends ${new Date(profile.trial_ends_at).toLocaleString()}.` : phoneTrialsEnabled ? 'Verify your phone number to claim your one-time 48-hour free trial.' : 'Your account is ready. Phone verification and the free trial will be added later.'}</p> : <p>Loading your trial details…</p>}
              {user.phone_confirmed_at ? <p className="account-owner-note">Verified phone: {user.phone ?? profile?.phone_number ?? 'confirmed'}</p> : phoneTrialsEnabled && <div className="account-checkout"><label htmlFor="trial-phone">Verify Kenyan phone for your free trial</label><input id="trial-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712345678" value={phone} onChange={(event) => setPhone(event.target.value)} /><button className="account-secondary" disabled={busy || !phone.trim()} onClick={() => void sendPhoneCode()}>{busy ? 'Please wait…' : 'Send verification code'}</button><label htmlFor="phone-code">6-digit SMS code</label><input id="phone-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, ''))} /><button className="primary-button" disabled={busy || verificationCode.length !== 6} onClick={() => void verifyPhone()}>{busy ? 'Verifying…' : 'Verify phone and start trial'}</button><p>One free trial per verified phone number. Your trial begins after verification. SMS delivery must be enabled for this project in Supabase.</p></div>}
              {passEndsAt && <p>Your paid day pass is active until {new Date(passEndsAt).toLocaleString()}.</p>}
              {checkoutEnabled ? <div className="account-checkout"><label htmlFor="mpesa-phone">Kenyan M-Pesa number</label><input id="mpesa-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712345678" value={phone} onChange={(event) => setPhone(event.target.value)} /><button className="primary-button" disabled={busy || !phone.trim()} onClick={() => void buyDayPass()}>{busy ? 'Waiting for M-Pesa…' : 'Get 1 day · KES 50'}</button><p>Approve the payment prompt on your phone. Access starts after M-Pesa confirms payment.</p></div> : <div className="account-checkout-status" role="status"><strong>Payments are not available yet.</strong><p>Your account is ready. Paid access will appear here after the M-Pesa service is approved and configured.</p></div>}
            </>}
            {isOwner && <button className="account-secondary" onClick={onOpenAdmin}>Open owner dashboard</button>}
            <button className="account-secondary" disabled={busy} onClick={signOut}>{busy ? 'Signing out…' : 'Sign out'}</button>
          </div>
        ) : (
          <>
            <p className="account-intro">Create a StreamBoXx account with your email. Phone verification and the free trial will be available after SMS setup.</p>
            <form className="account-form" onSubmit={submit}>
              {mode === 'signup' && <label>Your name<input autoComplete="name" maxLength={80} value={displayName} onChange={(event) => setDisplayName(event.target.value)} required /></label>}
              <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
              <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
            </form>
            <button className="account-mode-toggle" onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setNotice(''); }}>{mode === 'signup' ? 'Already have an account? Sign in' : 'New to StreamBoXx? Create an account'}</button>
          </>
        )}
        {notice && <p className="account-notice" role="status">{notice}</p>}
      </section>
    </div>
  );
}
