import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { syncEdition, syncVenue } from './main.js';

const TODAY = DateTime.fromISO('2026-09-28T12:00:00Z', { zone: 'utc' });

// ICLR 2027 as OpenReview served it on 2026-09-28.
const ICLR27 = {
  title: { value: 'The Fifteenth International Conference on Learning Representations' },
  website: { value: 'https://iclr.cc/Conferences/2027' },
  location: { value: 'San Francisco, CA, USA' },
  start_date: { value: 1808769600000 },
  date: { value: '' },
  submission_id: { value: 'ICLR.cc/2027/Conference/-/Submission' },
};

const COLM26 = {
  title: { value: 'Third Conference on Language Modeling' },
  website: { value: 'https://colmweb.org/' },
  location: { value: 'San Francisco, USA' },
  start_date: { value: 'Oct 06 2026' },
  date: { value: 'Submission Start: Feb 26 2026 11:59AM UTC-0, Abstract Registration: Mar 27 2026 11:59AM UTC-0, Submission Deadline: Apr 01 2026 12:15PM UTC-0' },
  submission_id: { value: 'colmweb.org/COLM/2026/Conference/-/Submission' },
};

const apiServing = (content, duedate = Date.parse('2026-09-19T11:59:00Z')) => ({
  getVenueGroup: async () => content,
  getSubmissionDuedate: async () => duedate,
});

const iclr26 = () => ({
  title: 'ICLR', year: 2026, id: 'iclr26', link: 'https://iclr.cc/',
  abstract_deadline: '2025-09-19 23:59', deadline: '2025-09-24 23:59', timezone: 'UTC-12',
  place: 'Rio de Janeiro, Brazil', date: 'April 23-27, 2026', start: '2026-04-23', end: '2026-04-27',
  sub: 'ML', type: 'conference',
});

describe('syncEdition', () => {
  it('never writes the Submission invitation due date, only reports it', async () => {
    const entries = [iclr26(), { title: 'ICLR', year: 2027, id: 'iclr27', link: 'https://iclr.cc/', timezone: 'UTC-12', sub: 'ML', type: 'conference' }];
    const out = await syncEdition({
      api: apiServing(ICLR27), entries, title: 'ICLR', venue: { prefix: 'ICLR.cc' }, year: 2027, today: TODAY,
    });
    expect(entries[1].deadline).toBeUndefined();
    expect(entries[1].abstract_deadline).toBeUndefined();
    expect(out.updates.map((c) => c.field)).not.toContain('deadline');
    expect(out.flags).toContain(
      'ICLR 2027: OpenReview states no deadlines; its submission form closes 2026-09-19 11:59 UTC, which is the abstract deadline at some venues and the paper deadline at others; deadline fields left untouched',
    );
  });

  it('stays quiet about missing deadlines when the entry already has them', async () => {
    const entries = [{ ...iclr26(), year: 2027, id: 'iclr27', deadline: '2026-09-24 23:59', start: undefined, end: undefined, date: undefined }];
    const out = await syncEdition({
      api: apiServing(ICLR27), entries, title: 'ICLR', venue: { prefix: 'ICLR.cc' }, year: 2027, today: TODAY,
    });
    expect(out.flags.some((f) => f.includes('states no deadlines'))).toBe(false);
  });

  it('leaves an edition that has already ended alone', async () => {
    const entries = [{ title: 'COLM', year: 2026, id: 'colm26', link: 'https://colmweb.org/', deadline: '2026-03-31 23:59',
      timezone: 'UTC-12', place: 'San Francisco, CA, USA', start: '2026-10-06', end: '2026-10-09', sub: 'NLP', type: 'conference' }];
    const later = DateTime.fromISO('2026-10-20T00:00:00Z', { zone: 'utc' });
    const out = await syncEdition({
      api: apiServing(COLM26), entries, title: 'COLM', venue: { prefix: 'colmweb.org/COLM' }, year: 2026, today: later,
    });
    expect(out.updates).toEqual([]);
    expect(entries[0].deadline).toBe('2026-03-31 23:59');
  });

  it('writes deadlines OpenReview states outright', async () => {
    const entries = [{ title: 'COLM', year: 2026, id: 'colm26', link: 'https://colmweb.org/',
      timezone: 'UTC-12', place: 'San Francisco, CA, USA', start: '2026-10-06', end: '2026-10-09', sub: 'NLP', type: 'conference' }];
    const early = DateTime.fromISO('2026-03-01T00:00:00Z', { zone: 'utc' });
    const out = await syncEdition({
      api: apiServing(COLM26), entries, title: 'COLM', venue: { prefix: 'colmweb.org/COLM' }, year: 2026, today: early,
    });
    expect(entries[0].abstract_deadline).toBe('2026-03-26 23:59');
    expect(entries[0].deadline).toBe('2026-04-01 00:15');
    expect(entries[0].place).toBe('San Francisco, CA, USA');
    expect(out.updates.map((c) => c.field).sort()).toEqual(['abstract_deadline', 'deadline', 'full_name']);
  });

  it('drafts a new edition with the website OpenReview gives for it', async () => {
    const entries = [iclr26()];
    const out = await syncEdition({
      api: apiServing(ICLR27), entries, title: 'ICLR', venue: { prefix: 'ICLR.cc' }, year: 2027, today: TODAY,
    });
    expect(out.drafts).toEqual([{ id: 'iclr27', title: 'ICLR', year: 2027 }]);
    const draft = entries.find((e) => e.id === 'iclr27');
    expect(draft.link).toBe('https://iclr.cc/Conferences/2027');
    expect(draft.place).toBe('San Francisco, CA, USA');
    expect(draft.deadline).toBeUndefined();
    expect(draft.start).toBeUndefined();
  });

  it('flags a new edition that has no previous edition to clone', async () => {
    const entries = [];
    const out = await syncEdition({
      api: apiServing(ICLR27), entries, title: 'ICLR', venue: { prefix: 'ICLR.cc' }, year: 2027, today: TODAY,
    });
    expect(entries).toEqual([]);
    expect(out.skipped).toEqual([]);
    expect(out.flags).toContain('ICLR 2027: no previous edition in the YAML to clone; add it manually');
  });

  it('flags a new edition of a venue with several entries per year, with the location OpenReview states', async () => {
    const entries = [iclr26()];
    const out = await syncEdition({
      api: apiServing(ICLR27), entries, title: 'ICLR', venue: { prefix: 'ICLR.cc', multiEntry: true }, year: 2027, today: TODAY,
    });
    expect(entries).toHaveLength(1);
    expect(out.flags).toContain(
      'ICLR 2027: new edition found; this venue has multiple entries per year, add them manually (location: San Francisco, CA, USA)',
    );
  });

  it('flags a large deadline move', async () => {
    const entries = [{ title: 'COLM', year: 2026, id: 'colm26', link: 'https://colmweb.org/', deadline: '2025-12-01 23:59',
      timezone: 'UTC-12', place: 'San Francisco, CA, USA', start: '2026-10-06', end: '2026-10-09', sub: 'NLP', type: 'conference' }];
    const early = DateTime.fromISO('2026-03-01T00:00:00Z', { zone: 'utc' });
    const out = await syncEdition({
      api: apiServing(COLM26), entries, title: 'COLM', venue: { prefix: 'colmweb.org/COLM' }, year: 2026, today: early,
    });
    expect(out.flags.some((f) => f.startsWith('colm26: large deadline move on deadline'))).toBe(true);
  });
});

describe('syncVenue', () => {
  it('syncs this year and the next two, collecting every outcome', async () => {
    const requested = [];
    const api = {
      getVenueGroup: async (...args) => {
        requested.push(args);
        if (args[1] === 2028) throw new Error('http 500');
        return null;
      },
    };
    const out = await syncVenue({ api, entries: [], title: 'ICLR', venue: { prefix: 'ICLR.cc' }, today: TODAY });
    expect(requested).toEqual([['ICLR.cc', 2026], ['ICLR.cc', 2027], ['ICLR.cc', 2028]]);
    expect(out).toEqual({ updates: [], drafts: [], flags: [], skipped: ['ICLR 2028: request failed (http 500)'] });
  });
});
