import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { changeFieldName, deadlineName, draftDeadlines, mergeDeadlines } from './deadlines.js';

const TODAY = DateTime.fromISO('2026-08-01T00:00:00Z', { zone: 'utc' });
const utc = (iso) => DateTime.fromISO(iso, { zone: 'utc' });
const at = (date) => utc(`${date}T11:59:00Z`); // 23:59 the day before in UTC-12
const ghf = (deadlines) => ({ id: 'ghf26', timezone: 'UTC-12', title: 'Geneva Health Forum', link: 'https://x', deadlines });

describe('mergeDeadlines', () => {
  it('updates the one item of the reported type', () => {
    const e = ghf([{ type: 'poster', due: '2026-09-01 23:59' }]);
    const { changes } = mergeDeadlines(e, [{ type: 'poster', due: at('2026-09-16') }], { today: TODAY });
    expect(e.deadlines).toEqual([{ type: 'poster', due: '2026-09-15 23:59' }]);
    expect(changes).toEqual([{ id: 'ghf26', field: 'deadlines', type: 'poster', reported: 'poster', old: '2026-09-01 23:59', new: '2026-09-15 23:59' }]);
  });

  it('moves a hand-checked poster when the source calls it an abstract, keeping the type', () => {
    const e = ghf([{ type: 'poster', due: '2026-09-15 23:59' }]);
    const { flags } = mergeDeadlines(e, [{ type: 'abstract', due: at('2026-10-01') }], { today: TODAY });
    expect(e.deadlines).toEqual([{ type: 'poster', due: '2026-09-30 23:59' }]);
    expect(flags).toEqual(['ghf26: source calls the poster deadline abstract; date updated, type kept']);
  });

  it('stays quiet when the family disagreement does not move the date', () => {
    const e = ghf([{ type: 'poster', due: '2026-09-15 23:59' }]);
    expect(mergeDeadlines(e, [{ type: 'abstract', due: at('2026-09-16') }], { today: TODAY })).toEqual({ changes: [], flags: [] });
  });

  it('leaves the family alone when the entry has two candidates', () => {
    const e = ghf([{ type: 'abstract', due: '2026-09-01 23:59' }, { type: 'poster', due: '2026-09-15 23:59' }]);
    const { changes, flags } = mergeDeadlines(e, [{ type: 'paper_abstract', due: at('2026-10-01') }], { today: TODAY });
    expect(changes).toEqual([]);
    expect(flags).toEqual(['ghf26: source reports a paper_abstract deadline (2026-09-30 23:59) but the entry has abstract, poster; left untouched']);
  });

  it('leaves the family alone when the source reports two family items', () => {
    const e = ghf([{ type: 'poster', due: '2026-09-15 23:59' }]);
    const { changes, flags } = mergeDeadlines(e, [
      { type: 'paper_abstract', due: at('2026-10-01') }, { type: 'abstract', due: at('2026-10-05') },
    ], { today: TODAY });
    expect(changes).toEqual([]);
    expect(flags).toEqual([
      'ghf26: source reports a paper_abstract deadline (2026-09-30 23:59) but the entry has poster; left untouched',
      'ghf26: source reports a abstract deadline (2026-10-04 23:59) but the entry has poster; left untouched',
    ]);
  });

  it('adds both of a source\'s own abstract and poster deadlines to an entry with neither', () => {
    const e = ghf([{ type: 'grant', due: '2026-08-15 23:59' }]);
    const { flags } = mergeDeadlines(e, [{ type: 'abstract', due: at('2026-09-02') }, { type: 'poster', due: at('2026-10-02') }], { today: TODAY });
    expect(e.deadlines.map((x) => x.type)).toEqual(['grant', 'abstract', 'poster']);
    expect(flags).toEqual([]);
  });

  it('adds a regular registration next to an early-bird one: no family fallback for registration', () => {
    const e = ghf([{ type: 'early_registration', due: '2026-10-14 23:59' }]);
    mergeDeadlines(e, [{ type: 'registration', due: at('2026-10-31') }], { today: TODAY });
    expect(e.deadlines.map((d) => d.type)).toEqual(['early_registration', 'registration']);
  });

  it('compares days in the entry zone before adding to the same group', () => {
    const e = ghf([{ type: 'early_registration', due: '2026-10-14 23:59' }]);
    const { flags } = mergeDeadlines(e, [{ type: 'registration', due: utc('2026-10-15T09:00:00Z') }], { today: TODAY });
    expect(e.deadlines).toHaveLength(1);
    expect(flags).toEqual(["ghf26: source reports a registration deadline on 2026-10-14, the day of the entry's early_registration deadline; not added"]);
  });

  it('lets other items and other groups share a day', () => {
    const e = ghf([{ type: 'other', label: 'Science Speed Talks video', due: '2026-09-15 23:59' }]);
    mergeDeadlines(e, [{ type: 'poster', due: at('2026-09-16') }, { type: 'grant', due: at('2026-09-16') }], { today: TODAY });
    expect(e.deadlines.map((d) => d.type)).toEqual(['other', 'poster', 'grant']);
  });

  it('flags a pinned item only when the source disagrees', () => {
    const e = ghf([{ type: 'poster', due: '2026-09-01 23:59', pin: true }]);
    expect(mergeDeadlines(e, [{ type: 'poster', due: at('2026-09-02') }], { today: TODAY }).flags).toEqual([]);
    expect(mergeDeadlines(e, [{ type: 'poster', due: at('2026-09-16') }], { today: TODAY }).flags)
      .toEqual(['ghf26: poster pinned; source reports 2026-09-15 23:59']);
    expect(e.deadlines[0].due).toBe('2026-09-01 23:59');
  });

  it('leaves a deadline alone when its old and new dates have both passed', () => {
    const e = ghf([{ type: 'poster', due: '2026-06-01 23:59' }]);
    expect(mergeDeadlines(e, [{ type: 'poster', due: at('2026-06-10') }], { today: TODAY }).changes).toEqual([]);
  });

  it('flags a type the entry lists twice', () => {
    const e = ghf([{ type: 'presenter_registration', label: 'Oral', due: '2026-10-20 23:59' }, { type: 'presenter_registration', label: 'Poster', due: '2026-10-30 23:59' }]);
    expect(mergeDeadlines(e, [{ type: 'presenter_registration', due: at('2026-11-01') }], { today: TODAY }).flags)
      .toEqual(['ghf26: 2 presenter_registration deadlines in the entry; source reports 2026-10-31 23:59; left untouched']);
  });

  it('flags a type the source reports twice', () => {
    const e = ghf([{ type: 'poster', due: '2026-09-01 23:59' }]);
    const { changes, flags } = mergeDeadlines(e, [{ type: 'poster', due: at('2026-09-16') }, { type: 'poster', due: at('2026-09-20') }], { today: TODAY });
    expect(changes).toEqual([]);
    expect(flags).toEqual(['ghf26: source reports poster twice; left untouched']);
  });

  it('adds the deadlines key after link on an entry without one', () => {
    const e = { id: 'x26', title: 'X', link: 'https://x', timezone: 'UTC-12', place: 'Geneva' };
    mergeDeadlines(e, [{ type: 'paper', due: at('2026-09-16') }], { today: TODAY });
    expect(Object.keys(e)).toEqual(['id', 'title', 'link', 'deadlines', 'timezone', 'place']);
  });

  it('keeps items in due order after a write', () => {
    const e = ghf([{ type: 'poster', due: '2026-09-01 23:59' }, { type: 'grant', due: '2026-09-10 23:59' }]);
    mergeDeadlines(e, [{ type: 'poster', due: at('2026-09-16') }], { today: TODAY });
    expect(e.deadlines.map((d) => d.type)).toEqual(['grant', 'poster']);
  });
});

describe('draftDeadlines', () => {
  it('renders reported deadlines in the zone, sorted, without labels', () => {
    expect(draftDeadlines([{ type: 'grant', due: at('2026-10-01') }, { type: 'poster', due: at('2026-09-16') }], 'UTC-12'))
      .toEqual([{ type: 'poster', due: '2026-09-15 23:59' }, { type: 'grant', due: '2026-09-30 23:59' }]);
  });
});

describe('naming', () => {
  it('names labeled items in report fields', () => {
    expect(changeFieldName({ field: 'deadlines', type: 'presenter_registration', label: 'Poster presenter registration' }))
      .toBe('presenter_registration "Poster presenter registration"');
    expect(changeFieldName({ field: 'place' })).toBe('place');
    expect(deadlineName({ type: 'poster' })).toBe('poster');
  });
});
