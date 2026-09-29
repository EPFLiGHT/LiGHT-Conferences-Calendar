import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { updateEntry, draftEntry, SYNC_PINNABLE_FIELDS } from './merge.js';

// The facts a source hands in, using the values scripts/sync-openreview
// produces for the NeurIPS 2026 Sydney edition (see its facts.test.js).
function neuripsFacts() {
  return {
    fullName: 'The Fortieth Annual Conference on Neural Information Processing Systems',
    location: 'Sydney, Australia',
    startIso: '2026-12-06',
    abstractDeadline: DateTime.fromISO('2026-05-05T11:59:00Z', { zone: 'utc' }),
    deadline: DateTime.fromISO('2026-05-07T11:59:00Z', { zone: 'utc' }),
  };
}

function sydneyEntry() {
  return {
    title: 'NeurIPS',
    year: 2026,
    id: 'neuripssy26',
    full_name: '40th Annual Conference on Neural Information Processing Systems',
    link: 'https://neurips.cc/',
    abstract_deadline: '2026-05-04 23:59',
    deadline: '2026-05-06 23:59',
    timezone: 'Australia/Sydney',
    place: 'Sydney, Australia',
    date: 'Dec 6-12, 2026',
    start: '2026-12-06',
    end: '2026-12-12',
    paperslink: 'https://neurips.cc/Conferences/2026/CallForPapers',
    sub: 'ML',
    type: 'conference',
    note: 'Main site; satellite sites in Atlanta and Paris.',
  };
}

describe('updateEntry', () => {
  it('rewrites deadlines in the entry timezone and records changes', () => {
    const entry = sydneyEntry();
    const { changes } = updateEntry(entry, neuripsFacts(), { deadlinesOnly: true });
    expect(entry.deadline).toBe('2026-05-07 21:59');
    expect(entry.abstract_deadline).toBe('2026-05-05 21:59');
    const fields = changes.map((c) => c.field).sort();
    expect(fields).toEqual(['abstract_deadline', 'deadline']);
    expect(changes[0].id).toBe('neuripssy26');
  });

  it('deadlinesOnly leaves place, start, end, full_name alone', () => {
    const entry = sydneyEntry();
    updateEntry(entry, neuripsFacts(), { deadlinesOnly: true });
    expect(entry.place).toBe('Sydney, Australia');
    expect(entry.start).toBe('2026-12-06');
    expect(entry.full_name).toBe('40th Annual Conference on Neural Information Processing Systems');
  });

  it('a moved start with a stated end rewrites start, end and date', () => {
    const entry = sydneyEntry();
    const facts = { ...neuripsFacts(), startIso: '2026-12-08', endIso: '2026-12-13', deadline: null, abstractDeadline: null, fullName: null, location: null };
    const { changes, flags } = updateEntry(entry, facts);
    expect(entry.start).toBe('2026-12-08');
    expect(entry.end).toBe('2026-12-13');
    expect(entry.date).toBe('Dec 8-13, 2026');
    expect(changes.map((c) => c.field)).toEqual(['start', 'end', 'date']);
    expect(flags).toEqual([]);
  });

  // OpenReview states a start but never an end.
  it('a moved start with no stated end leaves start, end and date alone and flags it', () => {
    const entry = sydneyEntry();
    const facts = { ...neuripsFacts(), startIso: '2026-12-08', deadline: null, abstractDeadline: null, fullName: null, location: null };
    const { changes, flags } = updateEntry(entry, facts);
    expect(entry.start).toBe('2026-12-06');
    expect(entry.end).toBe('2026-12-12');
    expect(entry.date).toBe('Dec 6-12, 2026');
    expect(changes).toEqual([]);
    expect(flags).toEqual([
      'neuripssy26: source moved start to 2026-12-08 but states no end; start, end and date left untouched, fix them by hand',
    ]);
  });

  it('a stated end alone rewrites end and date', () => {
    const entry = sydneyEntry();
    const facts = { ...neuripsFacts(), endIso: '2026-12-11', deadline: null, abstractDeadline: null, fullName: null, location: null };
    updateEntry(entry, facts);
    expect(entry.end).toBe('2026-12-11');
    expect(entry.date).toBe('Dec 6-11, 2026');
  });

  it('drops a source range that ends before it starts', () => {
    const entry = sydneyEntry();
    const facts = { ...neuripsFacts(), startIso: '2026-12-08', endIso: '2026-12-01', deadline: null, abstractDeadline: null, fullName: null, location: null };
    const { changes, flags } = updateEntry(entry, facts);
    expect(changes).toEqual([]);
    expect(flags.some((f) => f.includes('ends before it starts'))).toBe(true);
  });

  it('leaves start/end/date untouched and flags when the source start year is not the edition year', () => {
    const entry = sydneyEntry();
    const facts = { fullName: null, location: null, startIso: '2025-01-20', deadline: null, abstractDeadline: null };
    const { changes, flags } = updateEntry(entry, facts);
    expect(entry.start).toBe('2026-12-06');
    expect(entry.end).toBe('2026-12-12');
    expect(entry.date).toBe('Dec 6-12, 2026');
    expect(changes.map((c) => c.field)).not.toContain('start');
    expect(changes.map((c) => c.field)).not.toContain('end');
    expect(changes.map((c) => c.field)).not.toContain('date');
    expect(flags.some((f) => f.includes('neuripssy26') && f.includes('2025') && f.includes('2026'))).toBe(true);
  });

  it('is a no-op when facts match the entry', () => {
    const entry = sydneyEntry();
    updateEntry(entry, neuripsFacts(), { deadlinesOnly: true });
    const { changes: again, flags } = updateEntry(entry, neuripsFacts(), { deadlinesOnly: true });
    expect(again).toEqual([]);
    expect(flags).toEqual([]);
  });

  it('leaves a deadline alone when the old and new values have both passed', () => {
    const entry = sydneyEntry();
    const today = DateTime.fromISO('2026-09-28T12:00:00Z', { zone: 'utc' });
    const { changes } = updateEntry(entry, neuripsFacts(), { deadlinesOnly: true, today });
    expect(entry.deadline).toBe('2026-05-06 23:59');
    expect(changes).toEqual([]);
  });

  it('still corrects a passed deadline to a later one that is open', () => {
    const entry = sydneyEntry();
    const today = DateTime.fromISO('2026-05-07T00:00:00Z', { zone: 'utc' });
    const { changes } = updateEntry(entry, neuripsFacts(), { deadlinesOnly: true, today });
    expect(entry.deadline).toBe('2026-05-07 21:59');
    expect(changes.map((c) => c.field)).toContain('deadline');
  });

  it('never writes curated fields', () => {
    const entry = sydneyEntry();
    updateEntry(entry, neuripsFacts());
    expect(entry.sub).toBe('ML');
    expect(entry.link).toBe('https://neurips.cc/');
    expect(entry.note).toBe('Main site; satellite sites in Atlanta and Paris.');
  });

  it('leaves a pinned field untouched and flags the divergence', () => {
    const entry = { ...sydneyEntry(), sync_pin: ['deadline'] };
    const { changes, flags } = updateEntry(entry, neuripsFacts(), { deadlinesOnly: true });
    expect(entry.deadline).toBe('2026-05-06 23:59');
    expect(changes.map((c) => c.field)).not.toContain('deadline');
    expect(flags.some((f) => f.includes('neuripssy26') && f.includes('deadline pinned') && f.includes('2026-05-07 21:59'))).toBe(true);
  });

  it('still updates unpinned fields when another field is pinned', () => {
    const entry = { ...sydneyEntry(), sync_pin: ['deadline'] };
    updateEntry(entry, neuripsFacts(), { deadlinesOnly: true });
    expect(entry.abstract_deadline).toBe('2026-05-05 21:59');
  });

  it('a pinned start leaves end and date alone', () => {
    const entry = { ...sydneyEntry(), sync_pin: ['start'] };
    const facts = { ...neuripsFacts(), startIso: '2026-12-08', endIso: '2026-12-14', deadline: null, abstractDeadline: null, fullName: null, location: null };
    const { changes, flags } = updateEntry(entry, facts);
    expect(entry.start).toBe('2026-12-06');
    expect(entry.end).toBe('2026-12-12');
    expect(entry.date).toBe('Dec 6-12, 2026');
    expect(changes).toEqual([]);
    expect(flags.some((f) => f.includes('start pinned'))).toBe(true);
  });

  // The start move is large enough that reusing the pinned end would invert the
  // range; a two-day move would hide the bug behind a still-plausible date.
  it('a pinned end freezes start and date too, never inverting the range', () => {
    const entry = { ...sydneyEntry(), sync_pin: ['end'] };
    const facts = { ...neuripsFacts(), startIso: '2026-12-20', endIso: '2026-12-26', deadline: null, abstractDeadline: null, fullName: null, location: null };
    const { changes, flags } = updateEntry(entry, facts);
    expect(entry.start).toBe('2026-12-06');
    expect(entry.end).toBe('2026-12-12');
    expect(entry.date).toBe('Dec 6-12, 2026');
    expect(entry.start < entry.end).toBe(true);
    expect(changes).toEqual([]);
    expect(flags.some((f) => f.includes('end pinned'))).toBe(true);
  });

  it('a pinned date freezes start and end too, so the shown date never goes stale', () => {
    const entry = { ...sydneyEntry(), sync_pin: ['date'] };
    const facts = { ...neuripsFacts(), startIso: '2026-12-08', endIso: '2026-12-14', deadline: null, abstractDeadline: null, fullName: null, location: null };
    const { changes, flags } = updateEntry(entry, facts);
    expect(entry.start).toBe('2026-12-06');
    expect(entry.end).toBe('2026-12-12');
    expect(entry.date).toBe('Dec 6-12, 2026');
    expect(changes).toEqual([]);
    expect(flags.some((f) => f.includes('date pinned'))).toBe(true);
  });

  it('a pinned end still allows a start move when there is no end to shift', () => {
    const entry = { ...sydneyEntry(), end: undefined, date: undefined, sync_pin: ['end'] };
    const facts = { ...neuripsFacts(), startIso: '2026-12-20', deadline: null, abstractDeadline: null, fullName: null, location: null };
    updateEntry(entry, facts);
    expect(entry.start).toBe('2026-12-20');
  });

  it('does not flag a pinned field when the source agrees with it', () => {
    const entry = { ...sydneyEntry(), deadline: '2026-05-07 21:59', sync_pin: ['deadline'] };
    const { flags } = updateEntry(entry, neuripsFacts(), { deadlinesOnly: true });
    expect(flags).toEqual([]);
  });

  it('full_name is not pinnable', () => {
    expect(SYNC_PINNABLE_FIELDS).not.toContain('full_name');
  });
});

describe('updateEntry place', () => {
  const placeOnly = (location) => ({ fullName: null, location, startIso: null, deadline: null, abstractDeadline: null });

  it('fills a missing place from the source', () => {
    const entry = { ...sydneyEntry(), place: undefined };
    const { changes } = updateEntry(entry, placeOnly('Sydney, Australia'));
    expect(entry.place).toBe('Sydney, Australia');
    expect(changes.map((c) => c.field)).toEqual(['place']);
  });

  it('keeps a curated place and stays quiet when the source names the same city', () => {
    const entry = { ...sydneyEntry(), place: 'Boston, Massachusetts, USA' };
    const { changes, flags } = updateEntry(entry, placeOnly('Northeastern University, Boston'));
    expect(entry.place).toBe('Boston, Massachusetts, USA');
    expect(changes).toEqual([]);
    expect(flags).toEqual([]);
  });

  it('keeps a curated place and flags a source that names another city', () => {
    const entry = { ...sydneyEntry(), place: 'Paris, France' };
    const { changes, flags } = updateEntry(entry, placeOnly('Lyon, France'));
    expect(entry.place).toBe('Paris, France');
    expect(changes).toEqual([]);
    expect(flags).toEqual(['neuripssy26: place kept as "Paris, France"; source reports "Lyon, France"']);
  });
});

describe('updateEntry full_name', () => {
  const nameOnly = (fullName) => ({ fullName, location: null, startIso: null, deadline: null, abstractDeadline: null });

  it('fills a missing full_name from the source', () => {
    const entry = { ...sydneyEntry(), full_name: undefined };
    const { changes } = updateEntry(entry, nameOnly('The Fortieth Annual Conference on Neural Information Processing Systems'));
    expect(entry.full_name).toBe('The Fortieth Annual Conference on Neural Information Processing Systems');
    expect(changes.map((c) => c.field)).toEqual(['full_name']);
  });

  it('strips edition decoration before filling', () => {
    const entry = { ...sydneyEntry(), title: 'MLHC', full_name: undefined };
    updateEntry(entry, nameOnly('Machine Learning for Healthcare 2026'));
    expect(entry.full_name).toBe('Machine Learning for Healthcare');
  });

  it('never overwrites a curated full_name, and stays quiet on a decoration difference', () => {
    const entry = sydneyEntry();
    const { changes, flags } = updateEntry(entry, nameOnly('The Fortieth Annual Conference on Neural Information Processing Systems'));
    expect(entry.full_name).toBe('40th Annual Conference on Neural Information Processing Systems');
    expect(changes).toEqual([]);
    expect(flags).toEqual([]);
  });

  it('flags a source name whose core differs from the curated one', () => {
    const entry = sydneyEntry();
    const { changes, flags } = updateEntry(entry, nameOnly('Conference on Neural Information Processing'));
    expect(entry.full_name).toBe('40th Annual Conference on Neural Information Processing Systems');
    expect(changes).toEqual([]);
    expect(flags).toEqual([
      'neuripssy26: full_name kept as "40th Annual Conference on Neural Information Processing Systems"; source names it "Conference on Neural Information Processing"',
    ]);
  });

  it('ignores a source name that is only the title and year', () => {
    const entry = sydneyEntry();
    const { changes, flags } = updateEntry(entry, nameOnly('NeurIPS 2026'));
    expect(changes).toEqual([]);
    expect(flags).toEqual([]);
  });
});

describe('draftEntry', () => {
  it('clones the previous edition, drops stale fields, fills facts', () => {
    const prev = { ...sydneyEntry(), sync_pin: ['deadline'] };
    const { entry, flags } = draftEntry(prev, { ...neuripsFacts(), startIso: '2027-12-05', endIso: '2027-12-11' }, 2027);
    expect(entry.sync_pin).toBeUndefined();
    expect(entry.id).toBe('neuripssy27');
    expect(entry.year).toBe(2027);
    expect(entry.sub).toBe('ML');
    expect(entry.type).toBe('conference');
    expect(entry.timezone).toBe('Australia/Sydney');
    expect(entry.note).toBeUndefined();
    expect(entry.paperslink).toBeUndefined();
    expect(entry.start).toBe('2027-12-05');
    expect(entry.end).toBe('2027-12-11');
    expect(entry.date).toBe('Dec 5-11, 2027');
    expect(flags).toEqual([]);
  });

  it('never infers an end: without one from the source, end and date stay unset', () => {
    const { entry, flags } = draftEntry(sydneyEntry(), { ...neuripsFacts(), startIso: '2027-12-05' }, 2027);
    expect(entry.start).toBe('2027-12-05');
    expect(entry.end).toBeUndefined();
    expect(entry.date).toBeUndefined();
    expect(flags).toContain('no end date from the source yet; set end and date by hand');
  });

  it('takes the edition link from the source', () => {
    const prev = { ...sydneyEntry(), link: 'https://embc.embs.org/2026/' };
    const { entry, flags } = draftEntry(prev, { ...neuripsFacts(), link: 'https://embc.embs.org/2027/' }, 2027);
    expect(entry.link).toBe('https://embc.embs.org/2027/');
    expect(flags.some((f) => f.includes('link'))).toBe(false);
  });

  it('flags a cloned link that points at the previous edition', () => {
    const prev = { ...sydneyEntry(), link: 'https://embc.embs.org/2026/' };
    const { entry, flags } = draftEntry(prev, neuripsFacts(), 2027);
    expect(entry.link).toBe('https://embc.embs.org/2026/');
    expect(flags).toContain('link still points at the 2026 edition (https://embc.embs.org/2026/); update it by hand');
  });

  it('keeps an evergreen link quietly', () => {
    const { entry, flags } = draftEntry(sydneyEntry(), neuripsFacts(), 2027);
    expect(entry.link).toBe('https://neurips.cc/');
    expect(flags.some((f) => f.includes('link'))).toBe(false);
  });

  it('drops the cloned place when the source has none', () => {
    const { entry, flags } = draftEntry(sydneyEntry(), { ...neuripsFacts(), location: null }, 2027);
    expect(entry.place).toBeUndefined();
    expect(flags).toContain('no place from the source yet');
  });

  it('drops deadline fields when the source has none yet', () => {
    const prev = sydneyEntry();
    const { entry, flags } = draftEntry(
      prev,
      { fullName: null, location: null, startIso: null, abstractDeadline: null, deadline: null },
      2027,
    );
    expect(entry.deadline).toBeUndefined();
    expect(entry.abstract_deadline).toBeUndefined();
    expect(entry.start).toBeUndefined();
    expect(entry.end).toBeUndefined();
    expect(entry.date).toBeUndefined();
    expect(flags.length).toBeGreaterThan(0);
  });

  it('leaves start/end/date unset and flags when the source start year is not the draft year', () => {
    const prev = sydneyEntry();
    const facts = { ...neuripsFacts(), startIso: '2025-01-20' };
    const { entry, flags } = draftEntry(prev, facts, 2027);
    expect(entry.start).toBeUndefined();
    expect(entry.end).toBeUndefined();
    expect(entry.date).toBeUndefined();
    expect(flags.some((f) => f.includes('2025') && f.includes('2027'))).toBe(true);
  });

  it('takes the source full_name with the edition year stripped', () => {
    const prev = { ...sydneyEntry(), title: 'CVPR', full_name: 'Conference on Computer Vision and Pattern Recognition' };
    const facts = { ...neuripsFacts(), fullName: 'Conference on Computer Vision and Pattern Recognition 2027' };
    const { entry, flags } = draftEntry(prev, facts, 2027);
    expect(entry.full_name).toBe('Conference on Computer Vision and Pattern Recognition');
    expect(flags.some((f) => f.includes('full_name'))).toBe(false);
  });

  it('keeps the previous full_name and flags it when the source name is only the title', () => {
    const prev = sydneyEntry();
    const { entry, flags } = draftEntry(prev, { ...neuripsFacts(), fullName: 'NeurIPS 2027' }, 2027);
    expect(entry.full_name).toBe('40th Annual Conference on Neural Information Processing Systems');
    expect(flags).toContain('full_name kept from neuripssy26 (the source reports "NeurIPS 2027"); check its edition ordinal');
  });

  it('flags a full_name cloned without any source name', () => {
    const prev = sydneyEntry();
    const { entry, flags } = draftEntry(prev, { ...neuripsFacts(), fullName: null }, 2027);
    expect(entry.full_name).toBe('40th Annual Conference on Neural Information Processing Systems');
    expect(flags).toContain('full_name kept from neuripssy26 (the source has none); check its edition ordinal');
  });
});
