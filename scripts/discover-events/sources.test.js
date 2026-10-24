import fs from 'fs';
import { describe, it, expect } from 'vitest';
import { isAllowedUrl } from '../sync-llm/urls.js';

const readJson = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));

describe('sources.json', () => {
  it.each(Object.entries(readJson('./sources.json')))('configures %s with a fetchable url and known keys', (_, cfg) => {
    expect(isAllowedUrl(cfg.url).ok).toBe(true);
    expect(Object.keys(cfg).filter((k) => !['url', 'note'].includes(k))).toEqual([]);
  });
});

describe('seen.json', () => {
  it('records every proposal with a title, a year and a link, null for a listing page', () => {
    for (const s of Object.values(readJson('./seen.json'))) {
      expect(s).toMatchObject({ title: expect.any(String), year: expect.any(Number) });
      expect(s.link === null || typeof s.link === 'string').toBe(true);
    }
  });
});
