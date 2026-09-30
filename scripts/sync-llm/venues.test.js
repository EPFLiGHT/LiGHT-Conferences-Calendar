import fs from 'fs';
import { fileURLToPath } from 'url';
import { describe, it, expect } from 'vitest';
import { loadEntries } from '../sync-shared/yamlio.js';

const readJson = (rel) => JSON.parse(fs.readFileSync(new URL(rel, import.meta.url), 'utf8'));
const llmVenues = readJson('./venues.json');
const openreviewVenues = readJson('../sync-openreview/venues.json');
const titles = new Set(
  loadEntries(fileURLToPath(new URL('../../public/data/conferences.yaml', import.meta.url))).map((e) => e.title),
);

const unknownKeys = (cfg, known) => Object.keys(cfg).filter((k) => !known.includes(k));

describe('venues.json', () => {
  it('gives each venue to one sync only', () => {
    expect(Object.keys(llmVenues).filter((t) => t in openreviewVenues)).toEqual([]);
  });

  it('names only venues conferences.yaml has', () => {
    const missing = [...Object.keys(llmVenues), ...Object.keys(openreviewVenues)].filter((t) => !titles.has(t));
    expect(missing).toEqual([]);
  });

  it.each(Object.entries(llmVenues))('configures %s for the LLM sync with a url and known keys', (_, cfg) => {
    expect(typeof cfg.url).toBe('string');
    expect(unknownKeys(cfg, ['url', 'home', 'multiEntry', 'note'])).toEqual([]);
  });

  it.each(Object.entries(openreviewVenues))('configures %s for the OpenReview sync with a prefix and known keys', (_, cfg) => {
    expect(typeof cfg.prefix).toBe('string');
    expect(unknownKeys(cfg, ['prefix', 'multiEntry'])).toEqual([]);
  });
});
