import type { NewsItem } from '../news-feed';

export function NewsScreen({ newsItems }: { newsItems: NewsItem[] }) {
  return (
    <article className="card">
      <h2>News Feed</h2>
      {newsItems.length > 0 ? (
        <ul className="news-list">
          {newsItems.map((item) => (
            <li key={item.id} className="news-item">
              <span className={`news-chip chip-${item.category}`}>{item.category}</span>
              <div>
                <p className="news-headline">{item.headline}</p>
                <p className="news-week">Wk {item.week}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim">No news yet — sim some games to generate news</p>
      )}
    </article>
  );
}
