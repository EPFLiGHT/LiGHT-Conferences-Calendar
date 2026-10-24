import { describe, it, expect } from 'vitest';
import { nameKey, matchExisting, wasProposed, seenKey } from './dedupe.js';

const entry = (over = {}) => ({
  title: 'GESDA Summit', year: 2026, id: 'gesda26',
  full_name: 'Geneva Science Diplomacy Anticipation Summit',
  link: 'https://www.gesda.global/geneva-science-diplomacy-anticipation-summit/',
  start: '2026-10-14', end: '2026-10-15',
  ...over,
});

const event = (over = {}) => ({
  title: 'Anticipation Summit', full_name: null, year: 2026,
  link: 'https://www.gesda.global/', start: '2026-10-14', end: '2026-10-15',
  ...over,
});

describe('nameKey', () => {
  it('ignores case, accents, years, ordinals and filler words', () => {
    expect(nameKey('56th St. Gallen Symposium 2027')).toBe(nameKey('St Gallen Symposium'));
    expect(nameKey('Geneva Science and Diplomacy Anticipation Summit'))
      .toBe(nameKey('Geneva Science Diplomacy Anticipation Summit'));
    expect(nameKey('Zürich Forum')).toBe('zurich forum');
    expect(nameKey(null)).toBe('');
  });
});

describe('matchExisting', () => {
  it('matches the same edition by full name', () => {
    const found = event({ title: 'GESDA', full_name: 'Geneva Science and Diplomacy Anticipation Summit' });
    expect(matchExisting(found, [entry()]).same?.id).toBe('gesda26');
  });

  it('matches the same edition by host and overlapping dates when the names differ', () => {
    expect(matchExisting(event(), [entry()]).same?.id).toBe('gesda26');
    expect(matchExisting(event({ start: '2026-11-01', end: '2026-11-02' }), [entry()]).same).toBeNull();
  });

  it('does not match by link or host when the link is only a listing page', () => {
    expect(matchExisting(event({ ownLink: false }), [entry()]).same).toBeNull();
    expect(matchExisting(event({ title: 'Other' }), [event({ ownLink: false })]).same).toBeNull();
  });

  it('finds the latest earlier edition under the same name', () => {
    const entries = [entry({ year: 2025, id: 'gesda25' }), entry(), entry({ title: 'Other', full_name: null, year: 2025 })];
    const { same, prior } = matchExisting(event({ title: 'GESDA Summit', year: 2027, start: '2027-10-13', end: '2027-10-14' }), entries);
    expect(same).toBeNull();
    expect(prior.id).toBe('gesda26');
  });
});

describe('wasProposed', () => {
  it('recognizes an edition recorded in seen.json, by name or link', () => {
    const seen = { [seenKey({ title: 'Alpine Forum', year: 2027 })]: { title: 'Alpine Forum', full_name: null, year: 2027, link: 'https://alpine.example/' } };
    expect(wasProposed(seen, { title: 'Alpine Forum', year: 2027, link: 'https://elsewhere.example/' })).toBe(true);
    expect(wasProposed(seen, { title: 'Renamed', year: 2027, link: 'https://alpine.example' })).toBe(true);
    expect(wasProposed(seen, { title: 'Alpine Forum', year: 2028, link: 'https://alpine.example/' })).toBe(false);
  });
});
