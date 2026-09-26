import type { CatalogTitle } from '../data/catalog';

export default function TitleCard({ item, onSelect }: { item: CatalogTitle; onSelect: (item: CatalogTitle) => void }) {
  const kindLabel = item.format === 'short' ? 'Short' : item.format === 'trailer' ? 'Trailer' : item.kind;
  return (
    <button className="title-card" onClick={() => onSelect(item)} aria-label={`View details for ${item.title}`}>
      <span className={`poster-art art-${item.art} ${item.artworkUrl ? 'has-artwork' : ''}`}>
        {item.artworkUrl && <img className="poster-image" src={item.artworkUrl} alt="" loading="lazy" />}
        {item.label && <span className="poster-label">{item.label}</span>}
        <span className="poster-orb" aria-hidden="true" />
        <span className="poster-title">{item.title}</span>
        <span className="poster-kind">{kindLabel} · {item.year}</span>
      </span>
      <span className="card-caption"><strong>{item.title}</strong><span>{item.country ? `${item.country} · ` : ''}{item.genre}</span></span>
    </button>
  );
}
