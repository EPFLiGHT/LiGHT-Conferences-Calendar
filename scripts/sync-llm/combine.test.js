import { describe, it, expect } from 'vitest';
import { combineEditions } from './combine.js';
import { edition } from './test-helpers.js';

const d = (type, date, source, before = false) => ({ type, date, time: null, timezone_text: null, before, source, evidence: 'x' });

describe('combineEditions', () => {
  it('collapses one type on one day across pages, keeping the main page copy', () => {
    const { editions, flags } = combineEditions({ title: 'GHF', knownYears: new Set([2026]),
      main: [edition({ year: 2026, deadlines: [d('early_registration', '2026-10-14', 'main')] })],
      extras: [{ year: 2026, deadlines: [d('early_registration', '2026-10-14', 'fees'), d('grant', '2026-08-01', 'fees')] }] });
    expect(editions[0].deadlines.map((x) => [x.type, x.source])).toEqual([['early_registration', 'main'], ['grant', 'fees']]);
    expect(flags).toEqual([]);
  });

  it('drops a type the pages date differently', () => {
    const { editions, flags } = combineEditions({ title: 'GHF', knownYears: new Set([2026]),
      main: [edition({ year: 2026, deadlines: [d('poster', '2026-09-01', 'guide')] })],
      extras: [{ year: 2026, deadlines: [d('poster', '2026-09-15', 'call')] }] });
    expect(editions[0].deadlines).toEqual([]);
    expect(flags).toEqual(['GHF: 2026 poster deadline differs between pages (2026-09-01 on guide, 2026-09-15 on call); left out, check by hand']);
  });

  it('attaches extra-page years only to editions the data has', () => {
    const run = (known) => combineEditions({ title: 'GHF', knownYears: new Set(known), main: [], extras: [{ year: 2027, deadlines: [d('grant', '2027-03-01', 'fees')] }] });
    expect(run([2027]).editions.map((e) => [e.year, e.start_date])).toEqual([[2027, null]]);
    expect(run([]).flags).toEqual(['GHF: 2027 deadlines on fees match no edition on the main page or in the data; not drafted from an extra page']);
  });

  it('joins two extra pages of a year the main page lacks into one edition', () => {
    const { editions } = combineEditions({ title: 'GHF', knownYears: new Set([2027]), main: [], extras: [
      { year: 2027, deadlines: [d('grant', '2027-03-01', 'fees')] },
      { year: 2027, deadlines: [d('early_registration', '2027-02-01', 'register')] },
    ] });
    expect(editions.map((e) => [e.year, e.deadlines.map((x) => x.type)])).toEqual([[2027, ['grant', 'early_registration']]]);
  });

  it('treats "until 14 October" and "before 15 October" as one day', () => {
    const { editions, flags } = combineEditions({ title: 'GHF', knownYears: new Set([2026]), zone: 'UTC-12',
      main: [edition({ year: 2026, deadlines: [d('early_registration', '2026-10-14', 'main')] })],
      extras: [{ year: 2026, deadlines: [d('early_registration', '2026-10-15', 'fees', true)] }] });
    expect(editions[0].deadlines.map((x) => x.source)).toEqual(['main']);
    expect(flags).toEqual([]);
  });

  it('tells apart one date string that "before" moves a day', () => {
    const { editions, flags } = combineEditions({ title: 'GHF', knownYears: new Set([2026]), zone: 'UTC-12',
      main: [edition({ year: 2026, deadlines: [d('early_registration', '2026-10-15', 'main')] })],
      extras: [{ year: 2026, deadlines: [d('early_registration', '2026-10-15', 'fees', true)] }] });
    expect(editions[0].deadlines).toEqual([]);
    expect(flags).toEqual(['GHF: 2026 early_registration deadline differs between pages (2026-10-15 on main, 2026-10-14 on fees); left out, check by hand']);
  });

  it('passes the main editions through untouched without extra pages', () => {
    const main = [edition({ year: 2026 })];
    expect(combineEditions({ title: 'GHF', knownYears: new Set(), main, extras: [] })).toEqual({ editions: main, flags: [] });
  });
});
