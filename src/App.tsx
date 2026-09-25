import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import Sidebar from './components/Sidebar';
import TitleCard from './components/TitleCard';
import AccountDialog from './components/AccountDialog';
import OwnerDashboard from './components/OwnerDashboard';
import StreamPlayer from './components/StreamPlayer';
import { supabase } from './lib/supabase';
import { publicArchive, type CatalogTitle } from './data/catalog';

const HlsDemoPlayer = import.meta.env.DEV ? lazy(() => import('./components/HlsDemoPlayer')) : null;
const publicCatalogOnly = import.meta.env.VITE_PUBLIC_CATALOG_ONLY === 'true';
const ART_THEMES = ['blue', 'ember', 'current', 'orbit', 'paper', 'north', 'garden', 'rain', 'copper', 'wonders'];
type LibraryMode = 'loading' | 'preview' | 'live' | 'open' | 'empty' | 'unconfigured' | 'error';

type Page = 'Home' | 'Films' | 'Series' | 'Genres' | 'My List' | 'Continue Watching';

function App() {
  const [page, setPage] = useState<Page>('Home');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<CatalogTitle | null>(null);
  const [genre, setGenre] = useState('All');
  const [playerOpen, setPlayerOpen] = useState(false);
  const [playbackTitle, setPlaybackTitle] = useState<CatalogTitle | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [catalogue, setCatalogue] = useState<CatalogTitle[]>([]);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('loading');
  const [viewer, setViewer] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ trial_ends_at: string; account_status: 'active' | 'suspended' } | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('streamboxx-my-list');
      if (!stored) return [];
      const parsed: unknown = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setViewer(data.session?.user ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setViewer(session?.user ?? null);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !viewer) {
      setProfile(null);
      return;
    }
    let active = true;
    void supabase.from('profiles').select('trial_ends_at, account_status').eq('id', viewer.id).maybeSingle()
      .then(({ data }) => { if (active && data) setProfile(data); });
    return () => { active = false; };
  }, [viewer?.id]);

  useEffect(() => {
    if (!supabase || !viewer) {
      setIsOwner(false);
      setAdminOpen(false);
      return;
    }
    let active = true;
    void supabase.rpc('is_streamboxx_owner').then(({ data, error }) => {
      if (active) setIsOwner(!error && data === true);
    });
    return () => { active = false; };
  }, [viewer?.id]);

  useEffect(() => {
    let active = true;
    const catalogClient = supabase;
    if (catalogClient) {
      setLibraryMode('loading');
      void catalogClient.from('titles').select('id,title,synopsis,kind,release_year,genre,artwork_path').order('title')
        .then(async ({ data, error }) => {
          if (!active) return;
          if (error) {
            setCatalogue(publicArchive);
            setLibraryMode('error');
            return;
          }
          const rows = data ?? [];
          const originMap = new Map<string, { content_origin: CatalogTitle['contentOrigin']; creation_method: CatalogTitle['creationMethod'] }>();
          if (rows.length) {
            const { data: origins, error: originError } = await catalogClient.from('titles').select('id,content_origin,creation_method').in('id', rows.map((row) => row.id));
            if (!originError) for (const origin of origins ?? []) originMap.set(origin.id, origin);
          }
          if (!active) return;
          setCatalogue([...rows.map((row, index): CatalogTitle => ({
            id: row.id,
            title: row.title,
            kind: row.kind === 'series' ? 'Series' : 'Film',
            year: row.release_year ?? new Date().getFullYear(),
            genre: row.genre,
            detail: row.synopsis,
            art: ART_THEMES[index % ART_THEMES.length],
            artworkUrl: row.artwork_path || undefined,
            contentOrigin: originMap.get(row.id)?.content_origin ?? 'unverified',
            creationMethod: originMap.get(row.id)?.creation_method ?? 'human_created',
            label: index === 0 ? 'FEATURED' : undefined,
          })), ...publicArchive]);
          setLibraryMode(rows.length ? 'live' : 'open');
        });
    } else if (import.meta.env.DEV) {
      void import('./data/catalog').then(({ catalog: previewCatalogue }) => {
        if (!active) return;
        setCatalogue([...previewCatalogue, ...publicArchive]);
        setLibraryMode('preview');
      });
    } else {
      setCatalogue(publicArchive);
      setLibraryMode('open');
    }
    return () => { active = false; };
  }, []);

  function toggleSaved(item: CatalogTitle) {
    setSavedIds((current) => {
      const next = current.includes(item.id) ? current.filter((id) => id !== item.id) : [...current, item.id];
      try { localStorage.setItem('streamboxx-my-list', JSON.stringify(next)); } catch { /* Keep this session usable if storage is unavailable. */ }
      return next;
    });
  }

  function requestPlayback(item: CatalogTitle) {
    setSelected(null);
    if (!item.publicPlaybackUrl && !item.publicEmbedUrl && !viewer) {
      setAccountOpen(true);
      return;
    }
    setPlaybackTitle(item);
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return catalogue.filter((item) => {
      const matchesPage = page === 'Films' ? item.kind === 'Film' : page === 'Series' ? item.kind === 'Series' : true;
      const matchesGenre = genre === 'All' || item.genre === genre;
      const matchesSearch = !term || `${item.title} ${item.genre} ${item.detail}`.toLocaleLowerCase().includes(term);
      const matchesSaved = page !== 'My List' || savedIds.includes(item.id);
      return matchesPage && matchesGenre && matchesSearch && matchesSaved;
    });
  }, [catalogue, genre, page, query, savedIds]);

  const featured = catalogue[0];
  const genres = ['All', ...new Set(catalogue.map((item) => item.genre))];

  function navigate(next: Page) {
    setAdminOpen(false);
    setPage(next);
    setGenre('All');
    setQuery('');
    setSearchOpen(false);
  }

  const pageCopy: Record<Page, { title: string; subtitle: string }> = {
    Home: { title: 'Your next story starts here.', subtitle: libraryMode === 'preview' ? 'Development preview titles, ready to explore.' : 'Explore films and series cleared for StreamBoXx.' },
    Films: { title: 'Films', subtitle: 'Stories made for one sitting.' },
    Series: { title: 'Series', subtitle: 'Find a new world to return to.' },
    Genres: { title: 'Explore by mood', subtitle: 'Choose a genre and see where it takes you.' },
    'My List': { title: 'Your list', subtitle: 'A home for the titles you want to remember.' },
    'Continue Watching': { title: 'Pick up where you left off', subtitle: 'Your recent viewing will appear here once playback is added.' },
  };

  return (
    <div className="app-shell">
      <Sidebar current={page} onNavigate={navigate} />
      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">S</span> Stream<span className="brand-light">BoXx</span></div>
          <div className="topbar-spacer" />
          <form className={`search-box ${searchOpen ? 'search-open' : ''}`} onSubmit={(event) => event.preventDefault()} role="search">
            <span aria-hidden="true">⌕</span>
            <input aria-label="Search titles" placeholder="Search titles or genres" value={query} onFocus={() => setSearchOpen(true)} onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" className="clear-search" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
          </form>
          {import.meta.env.DEV && <button className="watch-demo-button" onClick={() => setPlayerOpen(true)} aria-label="Open HLS test player">Test player</button>}
          <button className="profile-button" onClick={() => setAccountOpen(true)} aria-label={viewer ? `Account for ${viewer.email ?? 'viewer'}` : 'Sign in or create an account'}>{viewer?.email?.charAt(0).toUpperCase() ?? 'J'}</button>
        </header>

        {adminOpen && isOwner ? <OwnerDashboard onClose={() => setAdminOpen(false)} /> : playerOpen && HlsDemoPlayer ? <Suspense fallback={<div className="player-loading-screen">Loading player…</div>}><HlsDemoPlayer onClose={() => setPlayerOpen(false)} /></Suspense> : page === 'Home' && !query && genre === 'All' && featured ? (
          <>
            <section className="hero" aria-labelledby="hero-title">
              <div className={`hero-art art-${featured.art} ${featured.artworkUrl ? 'has-artwork' : ''}`}>{featured.artworkUrl && <img src={featured.artworkUrl} alt="" />}<span className="hero-glow" /></div>
              <div className="hero-content">
                <div className="eyebrow"><span className="live-dot" /> STREAMBOXX <span className="eyebrow-divider">·</span> FEATURED TITLE</div>
                <h1 id="hero-title">{featured.title}</h1>
                <p className="hero-meta">{featured.year} <span>·</span> {featured.kind} <span>·</span> {featured.genre}</p>
                <p className="hero-description">{featured.detail}</p>
                <button className="primary-button" onClick={() => setSelected(featured)}><span aria-hidden="true">＋</span> Explore title</button>
              </div>
              <span className="hero-index">01 <i /> 04</span>
            </section>
            <div className="content-section home-rows">
              <ContentRow title="A little bit of everything" hint="FEATURED COLLECTION" items={catalogue.slice(1, 7)} onSelect={setSelected} />
              <ContentRow title="Films for tonight" hint="FILMS" items={catalogue.filter((item) => item.kind === 'Film')} onSelect={setSelected} />
              <ContentRow title="Stories in episodes" hint="SERIES" items={catalogue.filter((item) => item.kind === 'Series')} onSelect={setSelected} />
            </div>
          </>
        ) : (
          <section className="listing-page">
            <div className="page-heading">
              <div><p className="eyebrow">STREAMBOXX LIBRARY</p><h1>{query ? 'Search results' : pageCopy[page].title}</h1><p>{query ? `Titles matching “${query}”` : pageCopy[page].subtitle}</p></div>
            </div>

            {page === 'Genres' && !query && <div className="genre-pills" aria-label="Filter by genre">{genres.map((item) => <button key={item} className={genre === item ? 'selected' : ''} onClick={() => setGenre(item)}>{item}</button>)}</div>}

            {catalogue.length === 0 ? (
              <EmptyState icon={libraryMode === 'loading' ? '◷' : '✦'} title={libraryMode === 'loading' ? 'Loading the catalogue' : libraryMode === 'error' ? 'Catalogue unavailable' : libraryMode === 'unconfigured' ? 'Streaming library not connected' : 'No cleared titles yet'} body={libraryMode === 'preview' ? 'No preview titles are currently available.' : libraryMode === 'error' ? 'The catalogue could not be loaded. Please try again later.' : libraryMode === 'unconfigured' ? 'The public app shows only real titles with cleared rights and ready streaming media. Connect the production backend to continue.' : libraryMode === 'empty' ? 'Titles appear here after the owner records streaming rights, supplies ready media, and publishes them.' : 'Connecting to the licensed catalogue…'} />
            ) : page === 'My List' && !query && savedIds.length === 0 ? (
              <EmptyState icon="♡" title="Your list is ready when you are" body="Open any title and choose Add to My List to save it on this device." />
            ) : page === 'Continue Watching' && !query ? (
              <EmptyState icon="◷" title="Nothing playing yet" body={publicCatalogOnly ? 'Official-source films play on their original sites, so StreamBoXX does not track viewing progress in this public collection.' : 'Playback and progress tracking will be added in a later step.'} />
            ) : filtered.length ? (
              <div className="title-grid">{filtered.map((item) => <TitleCard key={item.id} item={item} onSelect={setSelected} />)}</div>
            ) : (
              <EmptyState icon="⌕" title="No titles found" body="Try another title or clear your search." action={query ? () => setQuery('') : undefined} />
            )}
          </section>
        )}
        <footer className="site-footer"><span>STREAMBOXX <i /> STREAMING LIBRARY</span><span>Watch films and series in the StreamBoXX player</span></footer>
      </main>

      {selected && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section className="detail-dialog" role="dialog" aria-modal="true" aria-labelledby="detail-title">
          <button className="dialog-close" onClick={() => setSelected(null)} aria-label="Close details">×</button>
          <div className={`dialog-art art-${selected.art} ${selected.artworkUrl ? 'has-artwork' : ''}`}>{selected.artworkUrl ? <img className="poster-image" src={selected.artworkUrl} alt={`${selected.title} cover artwork`} /> : <><span className="poster-orb" /><span className="poster-title">{selected.title}</span></>}</div>
          <div className="dialog-copy"><p className="eyebrow">{selected.kind.toUpperCase()} <span>·</span> {selected.year} <span>·</span> {selected.genre.toUpperCase()}</p><h2 id="detail-title">{selected.title}</h2><p>{selected.detail}</p><div className="detail-actions">{(selected.publicEmbedUrl || selected.publicPlaybackUrl || libraryMode === 'live') && <button className="primary-button" onClick={() => requestPlayback(selected)}>{selected.publicWatchLabel ?? (selected.publicPlaybackUrl || selected.publicEmbedUrl ? '▶ Watch now' : viewer ? '▶ Watch now' : 'Sign in to watch')}</button>}<button className="primary-button" onClick={() => toggleSaved(selected)}>{savedIds.includes(selected.id) ? '✓ Added to My List' : '＋ Add to My List'}</button><div className="demo-notice">{selected.publicWatchNote ?? (selected.publicPlaybackUrl || selected.publicEmbedUrl ? 'Watch in the StreamBoXX player.' : 'Playback checks your trial or day pass before opening a private stream.')}</div>{selected.publicSourceUrl && <details className="artwork-attribution"><summary>Credits and source details</summary><p>View the source and the applicable rights information for this title: <a href={selected.publicSourceUrl} target="_blank" rel="noreferrer">Open source details</a>.</p>{['openmovie-big-buck-bunny-2008','openmovie-tears-of-steel-2012','openmovie-sintel-2010'].includes(selected.id) && <p>Poster art: © Blender Foundation, used under <a href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">Creative Commons Attribution 3.0</a>. Sources: <a href="https://commons.wikimedia.org/wiki/File:Big_buck_bunny_poster_big.jpg" target="_blank" rel="noreferrer">Big Buck Bunny</a>, <a href="https://commons.wikimedia.org/wiki/File:Tos-poster.png" target="_blank" rel="noreferrer">Tears of Steel</a>, and <a href="https://commons.wikimedia.org/wiki/File:Sintel_poster.jpg" target="_blank" rel="noreferrer">Sintel</a>.</p>}</details>}</div></div>
        </section>
      </div>}
      {playbackTitle && <StreamPlayer titleId={playbackTitle.id} title={playbackTitle.title} publicPlaybackUrl={playbackTitle.publicPlaybackUrl} publicEmbedUrl={playbackTitle.publicEmbedUrl} publicSourceUrl={playbackTitle.publicSourceUrl} onClose={() => setPlaybackTitle(null)} />}
      {accountOpen && <AccountDialog user={viewer} profile={profile} isOwner={isOwner} onClose={() => setAccountOpen(false)} onOpenAdmin={() => { setAccountOpen(false); setAdminOpen(true); }} />}
    </div>
  );
}

function ContentRow({ title, hint, items, onSelect }: { title: string; hint: string; items: CatalogTitle[]; onSelect: (item: CatalogTitle) => void }) {
  return <section className="content-row"><div className="row-heading"><div><p>{hint}</p><h2>{title}</h2></div><span className="row-arrows" aria-hidden="true">‹　›</span></div><div className="row-track">{items.map((item) => <TitleCard key={item.id} item={item} onSelect={onSelect} />)}</div></section>;
}

function EmptyState({ icon, title, body, action }: { icon: string; title: string; body: string; action?: () => void }) {
  return <div className="empty-state"><span>{icon}</span><h2>{title}</h2><p>{body}</p>{action && <button onClick={action}>Clear search</button>}</div>;
}

export default App;


