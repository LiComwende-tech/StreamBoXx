export type CatalogTitle = {
  id: string;
  title: string;
  kind: 'Film' | 'Series';
  format?: 'film' | 'series' | 'short' | 'trailer';
  region?: 'african' | 'asian' | 'global';
  country?: string;
  year: number;
  genre: string;
  detail: string;
  art: string;
  artworkUrl?: string;
  label?: string;
  publicPlaybackUrl?: string;
  publicEmbedUrl?: string;
  publicSourceUrl?: string;
  publicWatchUrl?: string;
  publicWatchLabel?: string;
  publicWatchNote?: string;
  contentOrigin?: 'unverified' | 'streamboxx_original' | 'independent_creator' | 'public_domain' | 'licensed';
  creationMethod?: 'human_created' | 'ai_assisted' | 'ai_generated';
};


// Openly licensed and public-domain works live separately from StreamBoXX member titles.
export const publicArchive: CatalogTitle[] = [
  {
    id: 'openmovie-big-buck-bunny-2008', title: 'Big Buck Bunny', kind: 'Film', year: 2008,
    format: 'short', region: 'global',
    genre: 'Animation · Comedy',
    detail: 'A quick-witted rabbit turns the tables on a trio of woodland bullies in this playful animated short.',
    art: 'current', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: '/posters/big-buck-bunny.jpg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now',
    publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://peach.blender.org/about/',
  },
  {
    id: 'openmovie-tears-of-steel-2012', title: 'Tears of Steel', kind: 'Film', year: 2012,
    format: 'short', region: 'global',
    genre: 'Science fiction · Action',
    detail: 'In a ruined Amsterdam, a team of scientists and warriors make one last attempt to stop a machine uprising.',
    art: 'blue', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: '/posters/tears-of-steel.png',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/OHOpb2fS-cM?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now',
    publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://mango.blender.org/about/',
  },
  {
    id: 'sesame-street-official-episodes', title: 'Sesame Street', kind: 'Series', year: 1969,
    format: 'series', region: 'global',
    genre: 'Family · Education',
    detail: 'Songs, stories, and playful learning unfold in a lively neighbourhood where everyone has something to share.',
    art: 'wonders',
    artworkUrl: '/posters/sesame-street.svg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/videoseries?list=PL8TioFHubWFsnPhBmrDQ8dtoXxghDMKxr&playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch episodes',
    publicWatchNote: 'Watch episodes in the StreamBoXX player.',
    publicSourceUrl: 'https://www.youtube.com/@SesameStreet',
  },
  {
    id: 'openmovie-sintel-2010', title: 'Sintel', kind: 'Film', year: 2010,
    format: 'short', region: 'global',
    genre: 'Animation · Fantasy',
    detail: 'A young woman crosses a dangerous landscape to find the dragon she raised as a child.',
    art: 'ember', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: '/posters/sintel.jpg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/eRsGyueVLvQ?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now',
    publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://durian.blender.org/sharing/',
  },
  {
    id: 'archive-magician-1900', title: 'The Magician', kind: 'Film', year: 1900,
  format: 'short', region: 'global',
  genre: 'Fantasy · Silent film',
  detail: 'A stage magician makes objects appear, disappear, and change in this playful early short.',
  art: 'orbit', contentOrigin: 'public_domain', creationMethod: 'human_created',
  artworkUrl: '/posters/the-magician.svg',
  publicWatchNote: 'Silent film · it has no soundtrack.',
  publicPlaybackUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/56/The_Magician_%281900%29.webm',
  publicSourceUrl: 'https://commons.wikimedia.org/wiki/File:The_Magician_(1900).webm',
},
  {
    id: 'openmovie-spring-2019', title: 'Spring', kind: 'Film', year: 2019,
    format: 'short', region: 'global',
    genre: 'Fantasy · Adventure', detail: 'A shepherd girl and her dog face ancient spirits to continue the cycle of life.',
    art: 'garden', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: 'https://i.ytimg.com/vi/WhWc3b3KhnY/hqdefault.jpg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/WhWc3b3KhnY?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now', publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://studio.blender.org/projects/spring/pages/about/',
  },
  {
    id: 'openmovie-coffee-run-2020', title: 'Coffee Run', kind: 'Film', year: 2020,
    format: 'short', region: 'global',
    genre: 'Drama · Animation', detail: 'A young woman’s run for coffee brings memories of a relationship rushing back.',
    art: 'copper', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: 'https://i.ytimg.com/vi/PVGeM4OdABA/hqdefault.jpg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/PVGeM4OdABA?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now', publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://studio.blender.org/projects/coffee-run/pages/licensing/',
  },
  {
    id: 'openmovie-charge-2022', title: 'Charge', kind: 'Film', year: 2022,
    format: 'short', region: 'global',
    genre: 'Science fiction · Action', detail: 'An old man breaks into a battery factory and faces its deadly security robot.',
    art: 'ember', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: 'https://i.ytimg.com/vi/UXqq0ZvbOnk/hqdefault.jpg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/UXqq0ZvbOnk?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now', publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://studio.blender.org/projects/charge/',
  },
  {
    id: 'openmovie-sprite-fright-2021', title: 'Sprite Fright', kind: 'Film', year: 2021,
    format: 'short', region: 'global',
    genre: 'Comedy · Horror', detail: 'A group of teenagers in an isolated forest discover mushroom creatures with a surprising side.',
    art: 'wonders', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: 'https://i.ytimg.com/vi/_cMXraX_5RE/hqdefault.jpg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/_cMXraX_5RE?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now', publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://studio.blender.org/projects/sprite-fright/',
  },
  {
    id: 'openmovie-wing-it-2023', title: 'Wing It!', kind: 'Film', year: 2023,
    format: 'short', region: 'global',
    genre: 'Comedy · Animation', detail: 'An unexpected visitor launches an uptight engineer into an out-of-control space shuttle.',
    art: 'current', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: 'https://i.ytimg.com/vi/u9lj-c29dxI/hqdefault.jpg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/u9lj-c29dxI?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now', publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://studio.blender.org/projects/wing-it/',
  },
  {
    id: 'openmovie-caminandes-llamigos-2016', title: 'Caminandes: Llamigos', kind: 'Film', year: 2016,
    format: 'short', region: 'global',
    genre: 'Animation · Comedy', detail: 'In winter Patagonia, a llama and a penguin clash over the last tasty berry.',
    art: 'north', contentOrigin: 'independent_creator', creationMethod: 'human_created',
    artworkUrl: 'https://i.ytimg.com/vi/SkVqJ1SGeL0/hqdefault.jpg',
    publicEmbedUrl: 'https://www.youtube-nocookie.com/embed/SkVqJ1SGeL0?playsinline=1&rel=0',
    publicWatchLabel: '▶ Watch now', publicWatchNote: 'Watch in the StreamBoXX player.',
    publicSourceUrl: 'https://studio.blender.org/films/caminandes-llamigos/',
  },
];
// Fictional entries and CSS-only artwork keep this starter clear of unlicensed media.
export const catalog: CatalogTitle[] = [
  { id: 'blue-hour', title: 'The Blue Hour', kind: 'Film', year: 2025, genre: 'Drama', detail: 'A night-shift radio host receives a call that changes the quietest town on the coast.', art: 'blue', label: 'FEATURED' },
  { id: 'emberline', title: 'Emberline', kind: 'Series', year: 2025, genre: 'Mystery', detail: 'A mountain village follows a trail of lanterns to uncover a story its families forgot.', art: 'ember', label: 'NEW' },
  { id: 'wild-current', title: 'Wild Current', kind: 'Film', year: 2024, genre: 'Adventure', detail: 'Two siblings set out along a river to return a lost map to its maker.', art: 'current' },
  { id: 'quiet-orbit', title: 'Quiet Orbit', kind: 'Series', year: 2025, genre: 'Science fiction', detail: 'A small research crew finds unexpected company at the edge of a distant moon.', art: 'orbit', label: 'SERIES' },
  { id: 'paper-sky', title: 'Paper Sky', kind: 'Film', year: 2023, genre: 'Family', detail: 'A young inventor and her grandfather build a kite that brings a neighbourhood together.', art: 'paper' },
  { id: 'north-window', title: 'The North Window', kind: 'Series', year: 2024, genre: 'Drama', detail: 'Three friends renovate an old guesthouse and find their lives changing with it.', art: 'north' },
  { id: 'last-garden', title: 'The Last Garden', kind: 'Film', year: 2025, genre: 'Mystery', detail: 'A botanist returns home to solve the riddle behind a garden that blooms at midnight.', art: 'garden', label: 'NEW' },
  { id: 'after-rain', title: 'After the Rain', kind: 'Series', year: 2023, genre: 'Comedy', detail: 'A group of neighbours turn a flooded courtyard into the most unlikely community hub.', art: 'rain' },
  { id: 'copper-road', title: 'Copper Road', kind: 'Film', year: 2024, genre: 'Adventure', detail: 'A travelling mechanic takes one final delivery across a sunlit desert.', art: 'copper' },
  { id: 'small-wonders', title: 'Small Wonders', kind: 'Series', year: 2024, genre: 'Family', detail: 'Each week, a curious team of young makers solves a small problem in a big way.', art: 'wonders' },
];
