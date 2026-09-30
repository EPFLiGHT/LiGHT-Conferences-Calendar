import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { load, JSON_SCHEMA } from 'js-yaml';
import { loadEntries, parseEntries, serializeEntries } from './yamlio.js';

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
    const parsed = load(text); // DEFAULT schema, like src/utils/parser.ts
    expect(parsed[0].start).toBe('2026-10-06');
    expect(parsed[0].year).toBe(2026);
  });

  it('round-trips values exactly and is idempotent', () => {
    const second = { ...entry, id: 'colm27', year: 2027 };
    const text = serializeEntries([entry, second]);
    const reloaded = load(text, { schema: JSON_SCHEMA });
    expect(reloaded).toEqual([entry, second]);
    expect(serializeEntries(reloaded)).toBe(text);
  });

  it('separates entries with a blank line', () => {
    const text = serializeEntries([entry, { ...entry, id: 'colm27', year: 2027 }]);
    expect(text).toContain('\n\n- title:');
  });
});

describe('parseEntries', () => {
  it('keeps unquoted dates as strings and years as numbers', () => {
    const [parsed] = parseEntries('- id: colm26\n  year: 2026\n  start: 2026-10-06\n  deadline: 2026-04-01 12:15\n');
    expect(parsed).toEqual({ id: 'colm26', year: 2026, start: '2026-10-06', deadline: '2026-04-01 12:15' });
  });
});

describe('loadEntries', () => {
  it('reads what serializeEntries wrote', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yamlio-'));
    try {
      const file = path.join(dir, 'conferences.yaml');
      fs.writeFileSync(file, serializeEntries([entry]));
      expect(loadEntries(file)).toEqual([entry]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
