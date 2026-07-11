import { describe, it, expect } from 'vitest';
import { applyEditions } from './apply.js';

const edition = (year, date, evidence = `Deadline: ${date}`) => ({
  year, full_name: null, location: null, start_date: null, end_date: null,
  deadlines: [{ kind: 'paper', date, time: null, timezone_text: null, evidence }],
});

const entry = (over = {}) => ({
  title: 'HealthConf', year: 2026, id: 'hc26', link: 'https://hc.example',
  deadline: '2026-01-01 23:59', timezone: 'UTC-12', sub: 'Global Health', type: 'conference',
  ...over,
});

describe('applyEditions', () => {
  it('drops a deadline that falls after the entry conference start', () => {
    const entries = [entry({ start: '2026-07-26', deadline: undefined })];
    const { updates, flags, evidence } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2026, '2026-11-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(entries[0].deadline).toBeUndefined();
    expect(updates).toHaveLength(0);
    expect(evidence).toHaveLength(0);
    expect(flags[0]).toMatch(/after the conference start 2026-07-26/);
  });

  it('keeps a deadline that fits the postponed start the page reports', () => {
    // The page's new start supersedes the curated one, so the deadline must
    // not be checked against the stale YAML start while the dates still move.
    const entries = [entry({ start: '2026-06-22', deadline: undefined })];
    const postponed = { ...edition(2026, '2026-07-01'), start_date: '2026-09-10' };
    const { updates, flags } = applyEditions({
      entries, title: 'HealthConf', editions: [postponed],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(entries[0].deadline).toBe('2026-07-01 23:59');
    expect(entries[0].start).toBe('2026-09-10');
    expect(updates.length).toBeGreaterThan(0);
    expect(flags.some((f) => f.includes('belongs to a later edition'))).toBe(false);
  });

  it('keeps a deadline falling on the conference start day', () => {
    const entries = [entry({ start: '2026-11-01', deadline: undefined })];
    const { updates } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2026, '2026-11-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(updates).toHaveLength(1);
  });

  it('flags a deadline no start date could check, on an entry whose dates are still TBA', () => {
    const entries = [entry({ deadline: undefined })];
    const { updates, flags } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2026, '2026-11-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(updates).toHaveLength(1);
    expect(flags.some((f) => f.includes('hc26') && /could not be checked against it/.test(f))).toBe(true);
  });

  it('flags a deadline no start date could check, on a drafted edition', () => {
    const entries = [entry({ start: '2026-07-26' })];
    const { drafts, flags } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2027, '2027-02-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(drafts).toHaveLength(1);
    expect(flags.some((f) => f.includes('hc27') && /could not be checked against it/.test(f))).toBe(true);
  });

  it('does not flag when the page supplied a start date to check against', () => {
    const entries = [entry({ start: '2026-07-26' })];
    const withStart = { ...edition(2027, '2027-02-01'), start_date: '2027-07-26' };
    const { flags } = applyEditions({
      entries, title: 'HealthConf', editions: [withStart],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(flags.some((f) => /could not be checked against it/.test(f))).toBe(false);
  });

  it('does not flag an unchecked start when no deadline was extracted', () => {
    const entries = [entry({ deadline: undefined })];
    const noDeadlines = { ...edition(2026, '2026-11-01'), deadlines: [] };
    const { flags } = applyEditions({
      entries, title: 'HealthConf', editions: [noDeadlines],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(flags.some((f) => /could not be checked against it/.test(f))).toBe(false);
  });

  it('updates an existing entry and records evidence', () => {
    const entries = [entry()];
    const { updates, evidence, drafts } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2026, '2026-02-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(entries[0].deadline).toBe('2026-02-01 23:59');
    expect(updates).toHaveLength(1);
    expect(drafts).toHaveLength(0);
    expect(evidence[0]).toEqual({
      id: 'hc26', field: 'deadline', quote: 'Deadline: 2026-02-01', url: 'https://hc.example/dates',
    });
  });

  it('respects sync_pin (flag instead of write)', () => {
    const entries = [entry({ sync_pin: ['deadline'] })];
    const { updates, flags } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2026, '2026-02-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(entries[0].deadline).toBe('2026-01-01 23:59');
    expect(updates).toHaveLength(0);
    expect(flags.some((f) => f.includes('pinned'))).toBe(true);
  });

  it('drafts an unknown year from the latest previous edition', () => {
    const entries = [entry()];
    const { drafts } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2027, '2027-02-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(drafts).toEqual([{ id: 'hc27', title: 'HealthConf', year: 2027 }]);
    expect(entries).toHaveLength(2);
    expect(entries[1].id).toBe('hc27');
    expect(entries[1].deadline).toBe('2027-02-01 23:59');
  });

  it('never drafts for multiEntry venues, only flags', () => {
    const entries = [entry()];
    const { drafts, flags } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2027, '2027-02-01')],
      multiEntry: true, sourceUrl: 'https://hc.example/dates',
    });
    expect(drafts).toHaveLength(0);
    expect(entries).toHaveLength(1);
    expect(flags.some((f) => f.includes('add them manually'))).toBe(true);
  });

  it('flags large deadline moves', () => {
    const entries = [entry()];
    const { flags } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2026, '2026-06-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(flags.some((f) => f.includes('large deadline move'))).toBe(true);
  });

  it('does not record evidence for deadlines that fail to apply due to invalid timezone', () => {
    const entries = [entry({ timezone: 'Not/AZone' })];
    const { evidence, drafts } = applyEditions({
      entries, title: 'HealthConf', editions: [edition(2027, '2027-02-01')],
      sourceUrl: 'https://hc.example/dates',
    });
    expect(drafts).toHaveLength(1);
    const draftedEntry = entries[1];
    expect(draftedEntry.id).toBe('hc27');
    expect(draftedEntry.deadline).toBeUndefined();
    expect(evidence.some((e) => e.id === 'hc27' && e.field === 'deadline')).toBe(false);
  });
});
