import { useState } from 'react';
import type { NewsCategory, NewsItem } from '../news-feed';

type NewsFilter = 'all' | 'featured' | NewsCategory;

const FILTERS: Array<{ id: NewsFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'featured', label: 'Our Program' },
  { id: 'game', label: 'Games' },
  { id: 'recruiting', label: 'Recruiting' },
  { id: 'rankings', label: 'Polls' },
  { id: 'award', label: 'Awards' },
  { id: 'injury', label: 'Injuries' },
];

export function NewsScreen({ newsItems, userTeamName }: { newsItems: NewsItem[]; userTeamName?: string }) {
  const [filter, setFilter] = useState<NewsFilter>('all');
  const visible = newsItems.filter((item) =>
    filter === 'all' ? true : filter === 'featured' ? item.featured === true : item.category === filter,
  );

  // Items arrive newest first; group them under week headings in that order.
  const weeks: Array<{ week: number; items: NewsItem[] }> = [];
  for (const item of visible) {
    const last = weeks[weeks.length - 1];
    if (last && last.week === item.week) last.items.push(item);
    else weeks.push({ week: item.week, items: [item] });
  }

  return (
    <article className="card">
      <div className="news-header">
        <h2>News Feed</h2>
        <div className="news-filters" role="group" aria-label="Filter news">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`pos-filter-btn${filter === f.id ? ' active' : ''}`}
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
            >
              {f.id === 'featured' && userTeamName ? userTeamName : f.label}
            </button>
          ))}
        </div>
      </div>
      {newsItems.length === 0 ? (
        <p className="dim">No news yet. Sim some games to generate news.</p>
      ) : visible.length === 0 ? (
        <p className="dim">Nothing in this category yet.</p>
      ) : (
        weeks.map(({ week, items }) => (
          <section key={week} className="news-week-group">
            <h3 className="news-week-heading">Week {week}</h3>
            <ul className="news-list">
              {items.map((item) => (
                <li key={item.id} className={`news-item${item.featured ? ' news-featured' : ''}`}>
                  <span className={`news-chip chip-${item.category}`}>{item.category}</span>
                  <p className="news-headline">{item.headline}</p>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </article>
  );
}
