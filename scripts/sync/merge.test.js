import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { buildFacts, updateEntry, draftEntry } from './merge.js';

const group = JSON.parse(
  fs.readFileSync(new URL('./fixtures/neurips26-group.json', import.meta.url), 'utf8'),
).groups[0].content;

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

describe('buildFacts', () => {
  it('extracts facts from a real venue group', () => {
    const facts = buildFacts(group);
    expect(facts.fullName).toBe('The Fortieth Annual Conference on Neural Information Processing Systems');
    expect(facts.location).toBe('Sydney, Australia');
    expect(facts.startIso).toBe('2026-12-06');
    expect(facts.submissionId).toBe('NeurIPS.cc/2026/Conference/-/Submission');
    expect(facts.deadline.toISO()).toBe('2026-05-07T11:59:00.000Z');
    expect(facts.abstractDeadline.toISO()).toBe('2026-05-05T11:59:00.000Z');
  });

  it('nulls out placeholder locations', () => {
    const facts = buildFacts({ location: { value: 'TBD' } });
    expect(facts.location).toBeNull();
  });
});

describe('updateEntry', () => {
  it('rewrites deadlines in the entry timezone and records changes', () => {
    const entry = sydneyEntry();
    const { changes } = updateEntry(entry, buildFacts(group), { deadlinesOnly: true });
    expect(entry.deadline).toBe('2026-05-07 21:59');
    expect(entry.abstract_deadline).toBe('2026-05-05 21:59');
    const fields = changes.map((c) => c.field).sort();
    expect(fields).toEqual(['abstract_deadline', 'deadline']);
    expect(changes[0].id).toBe('neuripssy26');
  });

  it('deadlinesOnly leaves place, start, end, full_name alone', () => {
    const entry = sydneyEntry();
    updateEntry(entry, buildFacts(group), { deadlinesOnly: true });
    expect(entry.place).toBe('Sydney, Australia');
    expect(entry.start).toBe('2026-12-06');
    expect(entry.full_name).toBe('40th Annual Conference on Neural Information Processing Systems');
  });

  it('a moved start shifts end by the same delta and regenerates date', () => {
    const entry = sydneyEntry();
    const facts = { ...buildFacts(group), startIso: '2026-12-08', deadline: null, abstractDeadline: null, fullName: null, location: null };
    const { changes } = updateEntry(entry, facts);
    expect(entry.start).toBe('2026-12-08');
    expect(entry.end).toBe('2026-12-14');
    expect(entry.date).toBe('Dec 8-14, 2026');
    expect(changes.map((c) => c.field)).toEqual(['start', 'end', 'date']);
  });

  it('flags the end-shift when a moved start shifts the end', () => {
    const entry = sydneyEntry();
    const facts = { ...buildFacts(group), startIso: '2026-12-08', deadline: null, abstractDeadline: null, fullName: null, location: null };
    const { flags } = updateEntry(entry, facts);
    expect(flags.some((f) => f.includes('neuripssy26') && f.includes('end shifted'))).toBe(true);
  });

  it('leaves start/end/date untouched and flags when the start_date year is not the edition year', () => {
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
    updateEntry(entry, buildFacts(group), { deadlinesOnly: true });
    const { changes: again, flags } = updateEntry(entry, buildFacts(group), { deadlinesOnly: true });
    expect(again).toEqual([]);
    expect(flags).toEqual([]);
  });

  it('never writes curated fields', () => {
    const entry = sydneyEntry();
    updateEntry(entry, buildFacts(group));
    expect(entry.sub).toBe('ML');
    expect(entry.link).toBe('https://neurips.cc/');
    expect(entry.note).toBe('Main site; satellite sites in Atlanta and Paris.');
  });

  it('leaves a pinned field untouched and flags the divergence', () => {
    const entry = { ...sydneyEntry(), sync_pin: ['deadline'] };
    const { changes, flags } = updateEntry(entry, buildFacts(group), { deadlinesOnly: true });
    expect(entry.deadline).toBe('2026-05-06 23:59');
    expect(changes.map((c) => c.field)).not.toContain('deadline');
    expect(flags.some((f) => f.includes('neuripssy26') && f.includes('deadline pinned') && f.includes('2026-05-07 21:59'))).toBe(true);
  });

  it('still updates unpinned fields when another field is pinned', () => {
    const entry = { ...sydneyEntry(), sync_pin: ['deadline'] };
    updateEntry(entry, buildFacts(group), { deadlinesOnly: true });
    expect(entry.abstract_deadline).toBe('2026-05-05 21:59');
  });

  it('does not flag a pinned field when OpenReview agrees with it', () => {
    const entry = { ...sydneyEntry(), deadline: '2026-05-07 21:59', sync_pin: ['deadline'] };
    const { flags } = updateEntry(entry, buildFacts(group), { deadlinesOnly: true });
    expect(flags).toEqual([]);
  });
});

describe('draftEntry', () => {
  it('clones the previous edition, drops stale fields, fills facts', () => {
    const prev = { ...sydneyEntry(), sync_pin: ['deadline'] };
    const facts = buildFacts(group);
    const { entry, flags } = draftEntry(prev, { ...facts, startIso: '2027-12-05' }, 2027);
    expect(entry.sync_pin).toBeUndefined();
    expect(entry.id).toBe('neuripssy27');
    expect(entry.year).toBe(2027);
    expect(entry.sub).toBe('ML');
    expect(entry.type).toBe('conference');
    expect(entry.timezone).toBe('Australia/Sydney');
    expect(entry.note).toBeUndefined();
    expect(entry.paperslink).toBeUndefined();
    expect(entry.start).toBe('2027-12-05');
    expect(entry.end).toBe('2027-12-11'); // prev duration (6 days) applied
    expect(entry.date).toBe('Dec 5-11, 2027');
    expect(flags.some((f) => f.includes('inferred'))).toBe(true);
  });

  it('drops deadline fields when OpenReview has none yet', () => {
    const prev = sydneyEntry();
    const { entry, flags } = draftEntry(
      prev,
      { fullName: null, location: null, startIso: null, submissionId: null, abstractDeadline: null, deadline: null },
      2027,
    );
    expect(entry.deadline).toBeUndefined();
    expect(entry.abstract_deadline).toBeUndefined();
    expect(entry.start).toBeUndefined();
    expect(entry.end).toBeUndefined();
    expect(entry.date).toBeUndefined();
    expect(flags.length).toBeGreaterThan(0);
  });

  it('leaves start/end/date unset and flags when the start_date year is not the draft year', () => {
    const prev = sydneyEntry();
    const facts = { ...buildFacts(group), startIso: '2025-01-20' };
    const { entry, flags } = draftEntry(prev, facts, 2027);
    expect(entry.start).toBeUndefined();
    expect(entry.end).toBeUndefined();
    expect(entry.date).toBeUndefined();
    expect(flags.some((f) => f.includes('2025') && f.includes('2027'))).toBe(true);
  });
});
