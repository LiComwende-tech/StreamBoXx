type Page = 'Home' | 'Films' | 'Series' | 'African' | 'Asian' | 'Shorts' | 'Trailers' | 'Genres' | 'My List' | 'Continue Watching';

const links: { page: Page; icon: string }[] = [
  { page: 'Home', icon: '⌂' },
  { page: 'Films', icon: '▣' },
  { page: 'Series', icon: '▤' },
  { page: 'African', icon: '◉' },
  { page: 'Asian', icon: '◍' },
  { page: 'Shorts', icon: '▷' },
  { page: 'Trailers', icon: '▹' },
  { page: 'Genres', icon: '◈' },
  { page: 'My List', icon: '♡' },
  { page: 'Continue Watching', icon: '◷' },
];

export default function Sidebar({ current, onNavigate }: { current: Page; onNavigate: (page: Page) => void }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <button className="brand" onClick={() => onNavigate('Home')} aria-label="StreamBoXx home">
        <span className="brand-mark">S</span><span>Stream<span className="brand-light">BoXx</span></span>
      </button>
      <p className="nav-label">DISCOVER</p>
      <nav className="nav-list">
        {links.map(({ page, icon }) => (
          <button key={page} className={`nav-link ${current === page ? 'active' : ''}`} onClick={() => onNavigate(page)} aria-current={current === page ? 'page' : undefined}>
            <span className="nav-icon" aria-hidden="true">{icon}</span><span>{page}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

