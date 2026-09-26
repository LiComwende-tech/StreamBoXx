import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';

type Viewer = {
  id: string;
  email: string | null;
  display_name: string | null;
  phone_number: string | null;
  trial_ends_at: string | null;
  account_status: 'active' | 'suspended';
  created_at: string;
};

type Pass = { user_id: string; status: string; ends_at: string | null; starts_at: string | null; amount_kes: number; provider_checkout_id: string | null; provider_receipt: string | null; created_at: string; paid_at: string | null };
type Title = { id: string; title: string; kind: 'film' | 'series'; format: 'film' | 'series' | 'short' | 'trailer'; region: 'african' | 'asian' | 'global'; artwork_path: string | null; published_at: string | null; created_at: string; content_origin: 'unverified' | 'streamboxx_original' | 'independent_creator' | 'public_domain' | 'licensed'; creation_method: 'human_created' | 'ai_assisted' | 'ai_generated' };
type Rights = { title_id: string; rights_basis: string; rights_reference: string; artwork_rights_reference: string | null; rights_cleared_at: string | null; licence_expiry?: string | null; streaming_permitted?: boolean };
type MediaAsset = { id: string; title_id: string; provider: string; provider_asset_id: string; status: 'processing' | 'ready' | 'unavailable'; ready_at: string | null };

export default function OwnerDashboard({ onClose }: { onClose: () => void }) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [passes, setPasses] = useState<Pass[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [rightsRecords, setRightsRecords] = useState<Rights[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUser, setBusyUser] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [syncingMedia, setSyncingMedia] = useState(false);
  const [publishingTitle, setPublishingTitle] = useState('');

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    try {
      const [viewerResult, passResult, titleResult, rightsResult, mediaResult] = await Promise.all([
        supabase.from('profiles').select('id,email,display_name,phone_number,trial_ends_at,account_status,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('daily_passes').select('user_id,status,starts_at,ends_at,amount_kes,provider_checkout_id,provider_receipt,created_at,paid_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('titles').select('id,title,kind,artwork_path,published_at,created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('catalog_rights').select('title_id,rights_basis,rights_reference,artwork_rights_reference,rights_cleared_at,licence_expiry,streaming_permitted').order('updated_at', { ascending: false }).limit(500),
        supabase.from('media_assets').select('id,title_id,provider,provider_asset_id,status,ready_at').order('created_at', { ascending: false }).limit(500),
      ]);
      const failure = viewerResult.error ?? passResult.error ?? titleResult.error ?? rightsResult.error ?? mediaResult.error;
      if (failure) throw failure;
      setViewers((viewerResult.data ?? []) as Viewer[]);
      setPasses((passResult.data ?? []) as Pass[]);
      const baseTitles = (titleResult.data ?? []).map((row) => ({ ...row, format: row.kind === 'series' ? 'series' as const : 'film' as const, region: 'global' as const, content_origin: 'unverified' as const, creation_method: 'human_created' as const })) as Title[];
      if (baseTitles.length) {
        const { data: origins, error: originsError } = await supabase.from('titles').select('id,content_origin,creation_method,format,region').in('id', baseTitles.map((title) => title.id));
        if (!originsError && origins) {
          for (const origin of origins) {
            const title = baseTitles.find((row) => row.id === origin.id);
            if (title) { title.content_origin = origin.content_origin; title.creation_method = origin.creation_method; title.format = origin.format; title.region = origin.region; }
          }
        }
      }
      setTitles(baseTitles);
      setRightsRecords((rightsResult.data ?? []) as Rights[]);
      setMediaAssets((mediaResult.data ?? []) as MediaAsset[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The owner dashboard could not load. Check that the backend migration is applied.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function setSuspended(viewer: Viewer) {
    if (!supabase) return;
    setBusyUser(viewer.id);
    setNotice('');
    setError('');
    const suspend = viewer.account_status === 'active';
    const { error: updateError } = await supabase.from('profiles').update({
      account_status: suspend ? 'suspended' : 'active',
      suspended_at: suspend ? new Date().toISOString() : null,
    }).eq('id', viewer.id);
    setBusyUser('');
    if (updateError) setError(updateError.message);
    else {
      setNotice(suspend ? `Access suspended for ${viewer.email ?? 'this viewer'}.` : `Access restored for ${viewer.email ?? 'this viewer'}.`);
      await refresh();
    }
  }

  async function addDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get('title') ?? '').trim();
    const basis = String(form.get('rights_basis') ?? '');
    const rightsReference = String(form.get('rights_reference') ?? '').trim();
    const artworkPath = String(form.get('artwork_path') ?? '').trim();
    const trailerUrl = String(form.get('trailer_url') ?? '').trim();
    const artworkRightsReference = String(form.get('artwork_rights_reference') ?? '').trim();
    const contentOrigin = String(form.get('content_origin') ?? 'unverified');
    const creationMethod = String(form.get('creation_method') ?? 'human_created');
    const chosenFormat = String(form.get('format') ?? 'film');
    const cleared = form.get('rights_cleared') === 'on';
    const slug = title.toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) {
      setError('Enter a title using letters or numbers.');
      return;
    }
    if (artworkPath && !/^https:\/\//i.test(artworkPath)) {
      setError('Use a secure HTTPS poster image URL.');
      return;
    }
    if (trailerUrl && !/^https:\/\//i.test(trailerUrl)) {
      setError('Use a secure HTTPS link for the authorized trailer.');
      return;
    }
    if (cleared && (!basis || !rightsReference || (artworkPath && !artworkRightsReference))) {
      setError('Add the private title-rights record and, when using a poster, its separate artwork-rights record before confirming clearance.');
      return;
    }
    setSavingTitle(true);
    setError('');
    setNotice('');
    const titleDraft = {
      slug,
      title,
      synopsis: String(form.get('synopsis') ?? '').trim(),
      kind: chosenFormat === 'series' ? 'series' : 'film',
      release_year: Number(form.get('release_year')) || null,
      genre: String(form.get('genre') ?? 'Drama').trim(),
      artwork_path: artworkPath || null,
      published_at: null,
    };
    const extendedTitleDraft = {
      ...titleDraft,
      format: chosenFormat,
      region: String(form.get('region') ?? 'global'),
          country: String(form.get('country') ?? '').trim() || null,
          language: String(form.get('language') ?? '').trim() || null,
          director: String(form.get('director') ?? '').trim() || null,
      age_rating: String(form.get('age_rating') ?? '').trim() || null,
      cast_names: String(form.get('cast_names') ?? '').split(',').map((name) => name.trim()).filter(Boolean).slice(0, 40),
      trailer_url: trailerUrl || null,
      download_permitted: form.get('download_permitted') === 'on',
      duration_seconds: Number(form.get('duration_minutes')) > 0 ? Number(form.get('duration_minutes')) * 60 : null,
    };
    let { data: newTitle, error: insertError } = await supabase.from('titles').insert({ ...extendedTitleDraft, content_origin: contentOrigin, creation_method: creationMethod }).select('id').single();
    let savedWithoutOriginFields = false;
    if (insertError && /content_origin|creation_method|format|region|country|language|director|age_rating|duration_seconds|download_permitted|cast_names|trailer_url/i.test(insertError.message)) {
      const originInsert = await supabase.from('titles').insert({ ...titleDraft, content_origin: contentOrigin, creation_method: creationMethod }).select('id').single();
      newTitle = originInsert.data;
      insertError = originInsert.error;
      savedWithoutOriginFields = !originInsert.error;
    }
    if (insertError && /content_origin|creation_method/i.test(insertError.message)) {
      const legacyInsert = await supabase.from('titles').insert(titleDraft).select('id').single();
      newTitle = legacyInsert.data;
      insertError = legacyInsert.error;
      savedWithoutOriginFields = !legacyInsert.error;
    }
    setSavingTitle(false);
    if (insertError) setError(insertError.message);
    else {
      formElement.reset();
      let rightsSaved = true;
      if (newTitle && basis && rightsReference) {
        const { error: rightsError } = await supabase.from('catalog_rights').insert({
          title_id: newTitle.id,
          rights_basis: basis,
          rights_reference: rightsReference,
          artwork_rights_reference: artworkRightsReference || null,
          rights_cleared_at: cleared ? new Date().toISOString() : null,
          streaming_permitted: cleared && form.get('streaming_permitted') === 'on',
          licence_start: String(form.get('licence_start') ?? '') || null,
          licence_expiry: String(form.get('licence_expiry') ?? '') || null,
          territory: String(form.get('territories') ?? 'global').split(',').map((value) => value.trim()).filter(Boolean),
          contract_reference: String(form.get('contract_reference') ?? '').trim() || null,
          reviewed_by: (await supabase.auth.getUser()).data.user?.id ?? null,
        });
        if (rightsError) {
          rightsSaved = false;
          setError(`The private draft was saved, but its rights note was not: ${rightsError.message}`);
        }
      }
      if (rightsSaved) setNotice(savedWithoutOriginFields ? 'Draft saved. Apply the catalogue metadata migration before recording its content origin and publishing.' : 'Private draft saved. Publishing stays locked until the origin, rights, and streaming media are verified.');
      await refresh();
    }
  }

  async function syncMedia(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    const form = new FormData(event.currentTarget);
    const titleId = String(form.get('media_title_id') ?? '');
    const videoId = String(form.get('cloudflare_video_id') ?? '').trim();
    setSyncingMedia(true);
    setNotice('');
    setError('');
    try {
      const { data, error: functionError } = await supabase.functions.invoke('register-stream-asset', { body: { titleId, videoId } });
      if (functionError) {
        let explanation = functionError.message;
        if (functionError.context instanceof Response) {
          const body = await functionError.context.clone().json().catch(() => null);
          if (typeof body?.error === 'string') explanation = body.error;
        }
        throw new Error(explanation);
      }
      setNotice(typeof data?.message === 'string' ? data.message : 'Cloudflare video checked.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The video could not be checked.');
    } finally {
      setSyncingMedia(false);
    }
  }

  async function publishTitle(title: Title) {
    if (!supabase) return;
    const right = rightsRecords.find((record) => record.title_id === title.id);
    const readyAsset = mediaAssets.some((asset) => asset.title_id === title.id && asset.status === 'ready');
    if (title.content_origin === 'unverified' || !right?.rights_cleared_at || !right.rights_reference.trim() || (title.artwork_path && !right.artwork_rights_reference?.trim()) || !readyAsset) {
      setError('Publishing requires a verified content origin, cleared title and poster rights records, and verified ready media.');
      return;
    }
    setPublishingTitle(title.id);
    setError('');
    setNotice('');
    const { error: publishError } = await supabase.from('titles').update({ published_at: new Date().toISOString() }).eq('id', title.id).is('published_at', null);
    setPublishingTitle('');
    if (publishError) setError(publishError.message);
    else {
      setNotice(`${title.title} is now published in the licensed catalogue.`);
      await refresh();
    }
  }

  const now = Date.now();
  const activeTrials = viewers.filter((viewer) => viewer.account_status === 'active' && viewer.trial_ends_at && Date.parse(viewer.trial_ends_at) > now).length;
  const activePassUsers = new Set(passes.filter((pass) => pass.status === 'paid' && pass.ends_at && Date.parse(pass.ends_at) > now).map((pass) => pass.user_id)).size;

  return (
    <section className="owner-page" aria-labelledby="owner-title">
      <div className="owner-heading">
        <div><p className="eyebrow">PRIVATE · OWNER ONLY</p><h1 id="owner-title">Owner dashboard</h1><p>Manage viewer accounts and prepare a rights-cleared catalogue.</p></div>
        <div className="owner-heading-actions"><button className="account-secondary" onClick={() => void refresh()} disabled={loading}>Refresh</button><button className="account-secondary" onClick={onClose}>Back to StreamBoXx</button></div>
      </div>

      {error && <p className="admin-message admin-error" role="alert">{error}</p>}
      {notice && <p className="admin-message" role="status">{notice}</p>}

      <div className="owner-metrics">
        <article><span>Viewer accounts</span><strong>{loading ? '…' : viewers.length}</strong></article>
        <article><span>Active free trials</span><strong>{loading ? '…' : activeTrials}</strong></article>
        <article><span>Viewers with an active paid pass</span><strong>{loading ? '…' : activePassUsers}</strong></article>
        <article><span>Catalogue drafts</span><strong>{loading ? '…' : titles.filter((title) => !title.published_at).length}</strong></article>
      </div>

      <section className="owner-card"><div className="owner-card-heading"><div><p className="eyebrow">ACCOUNT ACCESS</p><h2>Viewers</h2></div></div>
        {loading ? <p className="admin-muted">Loading viewer accounts…</p> : viewers.length === 0 ? <p className="admin-muted">No viewer accounts yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Viewer</th><th>Phone verification</th><th>Joined</th><th>Trial status</th><th>Access</th><th>Owner action</th></tr></thead><tbody>{viewers.map((viewer) => <tr key={viewer.id}><td><strong>{viewer.display_name || 'Viewer'}</strong><small>{viewer.email || viewer.id}</small></td><td>{viewer.phone_number ? <><span className="status-pill published">Verified</span><small>{viewer.phone_number}</small></> : <span className="status-pill draft">Not verified</span>}</td><td>{new Date(viewer.created_at).toLocaleDateString()}</td><td>{viewer.trial_ends_at ? `Ends ${new Date(viewer.trial_ends_at).toLocaleString()}` : 'Not started'}</td><td><span className={`status-pill ${viewer.account_status}`}>{viewer.account_status}</span></td><td><button className="table-action" disabled={busyUser === viewer.id} onClick={() => void setSuspended(viewer)}>{busyUser === viewer.id ? 'Saving…' : viewer.account_status === 'active' ? 'Suspend' : 'Restore'}</button></td></tr>)}</tbody></table></div>}
      </section>

      <section className="owner-card"><div className="owner-card-heading"><div><p className="eyebrow">SUBSCRIPTIONS</p><h2>Daily passes and payment receipts</h2></div></div>
        {loading ? <p className="admin-muted">Loading pass records…</p> : passes.length === 0 ? <p className="admin-muted">No day-pass requests yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Viewer</th><th>Amount</th><th>Status</th><th>Purchased</th><th>Access period</th><th>M-Pesa receipt</th></tr></thead><tbody>{passes.map((pass, index) => { const viewer = viewers.find((item) => item.id === pass.user_id); return <tr key={`${pass.provider_checkout_id ?? pass.user_id}-${index}`}><td>{viewer?.email ?? pass.user_id}</td><td>KES {pass.amount_kes}</td><td><span className={`status-pill ${pass.status === 'paid' ? 'published' : 'draft'}`}>{pass.status}</span></td><td>{pass.paid_at ? new Date(pass.paid_at).toLocaleString() : new Date(pass.created_at).toLocaleString()}</td><td>{pass.starts_at && pass.ends_at ? `${new Date(pass.starts_at).toLocaleString()} – ${new Date(pass.ends_at).toLocaleString()}` : 'Not active'}</td><td>{pass.provider_receipt ?? (pass.status === 'pending' ? 'Waiting for M-Pesa' : '—')}</td></tr>; })}</tbody></table></div>}
      </section>

      <section className="owner-card"><div className="owner-card-heading"><div><p className="eyebrow">CATALOGUE RIGHTS</p><h2>Draft a title</h2></div></div>
        <form className="admin-title-form" onSubmit={addDraft}>
          <label>Title<input name="title" maxLength={180} required /></label>
          <label>Catalogue section<select name="format"><option value="film">Feature film</option><option value="series">Series</option><option value="short">Short</option><option value="trailer">Trailer</option></select></label>
          <label>Content category<select name="region"><option value="global">Global / unclassified</option><option value="african">African</option><option value="asian">Asian</option></select></label>
          <label>Country<input name="country" maxLength={80} placeholder="Country of origin" /></label>
          <label>Language<input name="language" maxLength={80} placeholder="Primary language" /></label>
          <label>Duration in minutes<input name="duration_minutes" type="number" min="1" max="1000" /></label>
          <label>Director<input name="director" maxLength={160} /></label>
          <label>Age rating<input name="age_rating" maxLength={24} placeholder="e.g. PG" /></label>
          <label>Cast<input name="cast_names" maxLength={1000} placeholder="Comma-separated names" /></label>
          <label>Authorized trailer URL<input name="trailer_url" type="url" maxLength={500} placeholder="https://…" /></label>
          <label>Licensed territories<input name="territories" maxLength={500} defaultValue="global" placeholder="e.g. Kenya, Uganda, Tanzania" /></label>
          <label>Contract reference<input name="contract_reference" maxLength={500} placeholder="Private agreement reference" /></label>
          <label>Release year<input name="release_year" type="number" min="1888" max="2200" /></label>
          <label>Genre<input name="genre" maxLength={80} defaultValue="Drama" required /></label>
          <label className="admin-wide">Licensed poster image URL<input name="artwork_path" type="url" maxLength={500} placeholder="https://…" /></label>
          <label className="admin-wide">Synopsis<textarea name="synopsis" maxLength={3000} rows={3} /></label>
          <label>Content origin<select name="content_origin" required defaultValue="unverified"><option value="unverified">Not verified</option><option value="streamboxx_original">StreamBoXX original</option><option value="independent_creator">Independent creator</option><option value="public_domain">Public domain</option><option value="licensed">Licensed</option></select></label>
          <label>How was it made?<select name="creation_method" required defaultValue="human_created"><option value="human_created">Human-created</option><option value="ai_assisted">AI-assisted</option><option value="ai_generated">AI-generated</option></select></label>
          <label>Rights basis<select name="rights_basis"><option value="">Not reviewed</option><option value="owned">Owned by StreamBoXx</option><option value="licensed">Licensed</option><option value="public_domain">Public domain</option></select></label>
          <label>Rights record reference<input name="rights_reference" maxLength={500} placeholder="Private contract or verification reference" /></label>
          <label>License starts<input name="licence_start" type="date" /></label>
          <label>License expires<input name="licence_expiry" type="date" /></label>
          <label className="rights-confirm"><input name="download_permitted" type="checkbox" /> Contract explicitly allows downloads</label>
          <label className="admin-wide">Poster artwork rights record<input name="artwork_rights_reference" maxLength={500} placeholder="Separate private record for this poster image" /></label>
          <label className="rights-confirm admin-wide"><input name="rights_cleared" type="checkbox" /> I have verified the title and any poster image rights and have supporting records.</label>
          <label className="rights-confirm admin-wide"><input name="streaming_permitted" type="checkbox" /> Rights specifically permit StreamBoXX to stream this title in the territories listed.</label>
          <div className="admin-wide"><button className="primary-button" disabled={savingTitle}>{savingTitle ? 'Saving…' : 'Save as private draft'}</button><p className="admin-muted">This does not publish or make a title streamable. Signed playback and media upload are separate stages.</p></div>
        </form>
      </section>

      <section className="owner-card"><div className="owner-card-heading"><div><p className="eyebrow">MEDIA DELIVERY</p><h2>Connect a Cloudflare Stream video</h2></div></div>
        <p className="admin-muted">Upload the licensed video in your private Cloudflare Stream dashboard with Require Signed URLs enabled. Paste its video ID here to verify readiness and attach it to a rights-cleared title.</p>
        <form className="admin-media-form" onSubmit={syncMedia}>
          <label>Title<select name="media_title_id" required defaultValue=""><option value="" disabled>Select a rights-cleared title</option>{titles.filter((title) => { const right = rightsRecords.find((record) => record.title_id === title.id); return Boolean(right?.rights_cleared_at && right.rights_reference.trim() && (!title.artwork_path || right.artwork_rights_reference?.trim())); }).map((title) => <option key={title.id} value={title.id}>{title.title}</option>)}</select></label>
          <label>Cloudflare video ID<input name="cloudflare_video_id" minLength={12} maxLength={80} pattern="[A-Za-z0-9_-]{12,80}" placeholder="Paste the video UID" required /></label>
          <button className="primary-button" disabled={syncingMedia}>{syncingMedia ? 'Checking video…' : 'Verify and link video'}</button>
        </form>
      </section>

      <section className="owner-card"><div className="owner-card-heading"><div><p className="eyebrow">CONTENT INVENTORY</p><h2>Titles and rights status</h2></div></div>
        {loading ? <p className="admin-muted">Loading title records…</p> : titles.length === 0 ? <p className="admin-muted">No title drafts yet.</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Title</th><th>Format / region</th><th>Content origin</th><th>Rights basis</th><th>Rights / expiry</th><th>Poster record</th><th>Media</th><th>Availability</th><th>Action</th></tr></thead><tbody>{titles.map((title) => { const right = rightsRecords.find((record) => record.title_id === title.id); const media = mediaAssets.find((asset) => asset.title_id === title.id); const cleared = Boolean(right?.rights_cleared_at && right.rights_reference.trim() && (!title.artwork_path || right.artwork_rights_reference?.trim())); const canPublish = cleared && right?.streaming_permitted !== false && (!right?.licence_expiry || right.licence_expiry >= new Date().toISOString().slice(0, 10)) && media?.status === 'ready' && !title.published_at; const expiryLabel = right?.licence_expiry ? (right.licence_expiry < new Date().toISOString().slice(0, 10) ? `Expired ${right.licence_expiry}` : `Until ${right.licence_expiry}`) : 'No expiry entered'; return <tr key={title.id}><td><strong>{title.title}</strong><small>{title.kind}</small></td><td>{title.format} · {title.region}</td><td>{title.content_origin.replaceAll('_', ' ')}</td><td>{right?.rights_basis || 'Not reviewed'}</td><td>{right?.rights_cleared_at ? <>{new Date(right.rights_cleared_at).toLocaleDateString()}<small>{right.streaming_permitted === false ? 'Streaming not permitted' : expiryLabel}</small></> : 'Needs review'}</td><td>{title.artwork_path ? (right?.artwork_rights_reference ? 'Recorded' : 'Needs review') : 'No poster'}</td><td>{media ? <><span className={`status-pill ${media.status === 'ready' ? 'published' : 'draft'}`}>{media.status}</span><small>{media.provider}</small></> : 'Not linked'}</td><td><span className={`status-pill ${title.published_at ? 'published' : 'draft'}`}>{title.published_at ? 'Published' : 'Private draft'}</span></td><td>{canPublish ? <button className="table-action" disabled={publishingTitle === title.id} onClick={() => void publishTitle(title)}>{publishingTitle === title.id ? 'Publishing…' : 'Publish'}</button> : title.published_at ? 'Live' : '—'}</td></tr>; })}</tbody></table></div>}
      </section>
      <p className="owner-footnote">Payment access is granted only after server-side Daraja verification. Live checkout remains disabled until Safaricom approves the merchant setup and the Supabase payment secrets are configured.</p>
    </section>
  );
}
