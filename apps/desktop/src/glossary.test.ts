import { describe, expect, it } from 'vitest';
import { GLOSSARY, GLOSSARY_CATEGORIES, glossaryByCategory, glossaryEntry, searchGlossary } from './glossary';

describe('glossary', () => {
  it('files every term under a listed category with a real definition', () => {
    const filed = GLOSSARY_CATEGORIES.flatMap((c) => glossaryByCategory(c));
    expect(filed).toHaveLength(Object.keys(GLOSSARY).length);
    for (const entry of filed) {
      expect(entry.definition.length).toBeGreaterThan(40);
      expect(entry.definition).not.toMatch(/—/);
    }
  });

  it('explains that interest is not a chance to land', () => {
    expect(glossaryEntry('interest').definition).toMatch(/not a chance to land/);
  });

  it('searches terms and definitions, ignoring case', () => {
    expect(searchGlossary('rpi').map((e) => e.id)).toContain('rpi');
    expect(searchGlossary('takeaways').map((e) => e.id)).toEqual(['stat-abbreviations']);
    expect(searchGlossary('   ')).toHaveLength(Object.keys(GLOSSARY).length);
    expect(searchGlossary('zzz')).toEqual([]);
  });
});
