import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { serializeEntries } from './yamlio.js';

const entry = {
  title: 'COLM',
  year: 2026,
  id: 'colm26',
  full_name: 'Third Conference on Language Modeling',
  link: 'https://colmweb.org/',
  abstract_deadline: '2026-03-27 11:59',
  deadline: '2026-04-01 12:15',
  timezone: 'UTC-12',
  place: 'San Francisco, USA',
  date: 'Oct 6-9, 2026',
  start: '2026-10-06',
  end: '2026-10-09',
  sub: 'NLP',
  type: 'conference',
};

describe('serializeEntries', () => {
  it('keeps date-like strings as strings for default-schema loaders', () => {
    const text = serializeEntries([entry]);
    const parsed = yaml.load(text); // DEFAULT schema, like src/utils/parser.ts
    expect(parsed[0].start).toBe('2026-10-06');
    expect(parsed[0].year).toBe(2026);
  });

  it('round-trips values exactly and is idempotent', () => {
    const second = { ...entry, id: 'colm27', year: 2027 };
    const text = serializeEntries([entry, second]);
    const reloaded = yaml.load(text, { schema: yaml.JSON_SCHEMA });
    expect(reloaded).toEqual([entry, second]);
    expect(serializeEntries(reloaded)).toBe(text);
  });

  it('separates entries with a blank line', () => {
    const text = serializeEntries([entry, { ...entry, id: 'colm27', year: 2027 }]);
    expect(text).toContain('\n\n- title:');
  });
});
