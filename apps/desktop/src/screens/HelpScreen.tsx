import { useState } from 'react';
import { GLOSSARY_CATEGORIES, glossaryByCategory, searchGlossary } from '../glossary';

/** Every term the game uses, in plain words, plus how a season flows. */
export function HelpScreen() {
  const [query, setQuery] = useState('');
  const matches = query.trim() ? searchGlossary(query) : null;

  return (
    <div className="help-page">
      <article className="card help-intro">
        <p className="eyebrow">Help</p>
        <h2>How a season works</h2>
        <ol className="help-steps">
          <li>Each week, check <strong>Recommended Actions</strong> on the Week Hub, then press <strong>Continue</strong>.</li>
          <li>Recruit all season: scout, offer scholarships, pitch what each recruit cares about. Watch the <strong>Chance to land</strong>.</li>
          <li>Win enough to make the NCAA field. If you&apos;re out, <strong>Sim to Offseason</strong> skips ahead.</li>
          <li>In the offseason, work the to-do list (investments, portal, staff), then start the next season.</li>
        </ol>
      </article>

      <article className="card help-glossary" aria-label="Glossary">
        <div className="help-glossary-head">
          <h2>Glossary</h2>
          <input
            type="search"
            className="help-search"
            placeholder="Search terms"
            aria-label="Search terms"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {matches ? (
          matches.length > 0 ? (
            <dl className="help-terms">
              {matches.map((e) => (
                <div key={e.id} className="help-term">
                  <dt>{e.term}</dt>
                  <dd>{e.definition}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="dim">No terms match “{query}”.</p>
          )
        ) : (
          GLOSSARY_CATEGORIES.map((category) => (
            <section key={category} className="help-category">
              <p className="section-label">{category}</p>
              <dl className="help-terms">
                {glossaryByCategory(category).map((e) => (
                  <div key={e.id} className="help-term">
                    <dt>{e.term}</dt>
                    <dd>{e.definition}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))
        )}
      </article>
    </div>
  );
}
