import { describe, it, expect } from 'vitest';
import { buildDraft } from './drafts.js';
import { validateEntry } from '../../src/utils/conferenceSchema.js';

const event = (over = {}) => ({
  title: 'St. Gallen Symposium', full_name: null, year: 2027,
  start: '2027-04-28', end: '2027-04-29', city: 'St. Gallen',
  link: 'https://symposium.org/', type: 'summit', subjects: ['Global Affairs'],
  ...over,
});

describe('buildDraft', () => {
  it('drafts a schema-valid summit entry', () => {
    const { entry, file } = buildDraft(event(), { takenIds: new Set() });
    expect(file).toBe('summits.yaml');
    expect(entry).toEqual({
      title: 'St. Gallen Symposium',
      year: 2027,
      id: 'stgallensymposium27',
      deadline_status: 'attendance',
      link: 'https://symposium.org/',
      timezone: 'Europe/Zurich',
      place: 'St. Gallen, Switzerland',
      date: 'Apr 28-29, 2027',
      start: '2027-04-28',
      end: '2027-04-29',
      sub: 'Global Affairs',
      type: 'summit',
    });
    expect(validateEntry(entry, 0)).toEqual([]);
  });

  it('keeps a prior edition\'s title, full name, subject, type and id pattern', () => {
    const prior = {
      title: 'GESDA Summit', id: 'gesda26', full_name: 'Geneva Science Diplomacy Anticipation Summit',
      sub: 'Global Health', type: 'summit',
    };
    const { entry, notes } = buildDraft(event({ title: 'Anticipation Summit', type: 'conference' }), { prior, takenIds: new Set() });
    expect(entry).toMatchObject({
      title: 'GESDA Summit', id: 'gesda27', full_name: 'Geneva Science Diplomacy Anticipation Summit',
      sub: 'Global Health', type: 'summit',
    });
    expect(notes).toEqual(['full_name kept from gesda26; check its edition ordinal']);
  });

  it('prefers the page\'s full name, without its year', () => {
    const prior = { title: 'WHA', id: 'wha26', full_name: 'Seventy-ninth World Health Assembly', type: 'summit' };
    const { entry, notes } = buildDraft(
      event({ full_name: 'Eightieth World Health Assembly 2027' }),
      { prior, takenIds: new Set() },
    );
    expect(entry.full_name).toBe('Eightieth World Health Assembly');
    expect(notes).toEqual([]);
  });

  it('lists several subjects as an array', () => {
    const { entry } = buildDraft(event({ subjects: ['AI', 'Global Affairs'] }), { takenIds: new Set() });
    expect(entry.sub).toEqual(['AI', 'Global Affairs']);
  });

  it('refuses an id that is already taken', () => {
    expect(buildDraft(event(), { takenIds: new Set(['stgallensymposium27']) }).error).toMatch(/already taken/);
  });
});
