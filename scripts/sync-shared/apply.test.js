import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { previousEdition, applyEdition, bigMoveFlags } from './apply.js';

const utc = (iso) => DateTime.fromISO(iso, { zone: 'utc' });

const entry = (over = {}) => ({
  title: 'Conf', year: 2026, id: 'conf26', link: 'https://conf.example/',
  deadline: '2026-01-01 23:59', timezone: 'UTC', sub: 'ML', type: 'conference',
  ...over,
});

const facts = (over = {}) => ({
  fullName: null, location: null, startIso: null, endIso: null, link: null,
  abstractDeadline: null, deadline: utc('2026-02-01T23:59:00Z'),
  ...over,
});

const apply = (entries, over = {}) =>
  applyEdition({ entries, title: 'Conf', year: 2026, factsFor: () => facts(), ...over });

describe('previousEdition', () => {
  it('picks the latest earlier edition with the same title', () => {
    const entries = [
      entry({ year: 2024, id: 'conf24' }),
      entry(),
      entry({ title: 'Other', year: 2026, id: 'other26' }),
      entry({ year: 2027, id: 'conf27' }),
    ];
    expect(previousEdition(entries, 'Conf', 2028).id).toBe('conf27');
    expect(previousEdition(entries, 'Conf', 2027).id).toBe('conf26');
    expect(previousEdition(entries, 'Conf', 2024)).toBeUndefined();
  });
});

describe('applyEdition', () => {
  it('updates every open entry of the edition', () => {
    const entries = [entry(), entry({ id: 'conf26b', place: 'Lima, Peru' })];
    const out = apply(entries);
    expect(entries.map((e) => e.deadline)).toEqual(['2026-02-01 23:59', '2026-02-01 23:59']);
    expect(out.updates.map((c) => c.id)).toEqual(['conf26', 'conf26b']);
    expect(out.drafts).toEqual([]);
    expect(out.drafted).toBeNull();
  });

  it('leaves an edition that has ended alone', () => {
    const entries = [entry({ start: '2026-03-01', end: '2026-03-03' })];
    const out = apply(entries, { today: utc('2026-06-01T00:00:00Z') });
    expect(out.updates).toEqual([]);
    expect(entries[0].deadline).toBe('2026-01-01 23:59');
  });

  it('writes only deadlines for a venue with several entries per year', () => {
    const entries = [entry()];
    apply(entries, { multiEntry: true, factsFor: () => facts({ location: 'Lima, Peru' }) });
    expect(entries[0].deadline).toBe('2026-02-01 23:59');
    expect(entries[0].place).toBeUndefined();
  });

  it('flags a new edition of a venue with several entries per year, with what the source states', () => {
    const entries = [entry({ year: 2025, id: 'conf25' })];
    const out = apply(entries, {
      multiEntry: true,
      factsFor: () => facts({ location: 'Sydney, Australia', startIso: '2026-12-06' }),
    });
    expect(entries).toHaveLength(1);
    expect(out.flags).toEqual([
      'Conf 2026: new edition found; this venue has multiple entries per year, add them manually (location: Sydney, Australia; start: 2026-12-06)',
    ]);
  });

  it('leaves the source detail out of that flag when the source states none', () => {
    const out = apply([], { multiEntry: true });
    expect(out.flags).toEqual([
      'Conf 2026: new edition found; this venue has multiple entries per year, add them manually',
    ]);
  });

  it('flags a new edition that has no previous edition to clone', () => {
    const entries = [entry({ title: 'Other', id: 'other26' })];
    const out = apply(entries);
    expect(entries).toHaveLength(1);
    expect(out.drafts).toEqual([]);
    expect(out.flags).toEqual(['Conf 2026: no previous edition in the YAML to clone; add it manually']);
    expect(out.skipped).toBeUndefined();
  });

  it('drafts a new edition right after the previous one and prefixes its flags with the new id', () => {
    const entries = [entry({ year: 2025, id: 'conf25' }), entry({ title: 'Other', id: 'other26' })];
    const out = apply(entries);
    expect(entries.map((e) => e.id)).toEqual(['conf25', 'conf26', 'other26']);
    expect(out.drafts).toEqual([{ id: 'conf26', title: 'Conf', year: 2026 }]);
    expect(out.drafted).toBe(entries[1]);
    expect(out.flags).toContain('conf26: no place from the source yet');
  });

  it('reads facts in the timezone of the entry they land in', () => {
    const zones = [];
    const factsFor = (zone) => {
      zones.push(zone);
      return facts();
    };
    apply([entry({ timezone: 'Europe/Paris' })], { factsFor });
    apply([entry({ year: 2025, id: 'conf25', timezone: 'Asia/Tokyo' })], { factsFor });
    expect(zones).toEqual(['Europe/Paris', 'Asia/Tokyo']);
  });

  it('lets screen drop facts before they are written, a draft showing up as its id and zone', () => {
    const targets = [];
    const screen = (f, target) => {
      targets.push(target);
      f.deadline = null;
      return [`${target.id}: screened`];
    };
    const existing = [entry()];
    const updated = apply(existing, { screen });
    expect(existing[0].deadline).toBe('2026-01-01 23:59');
    expect(updated.flags).toEqual(['conf26: screened']);

    const drafted = apply([entry({ year: 2025, id: 'conf25' })], { screen });
    expect(drafted.drafted.deadline).toBeUndefined();
    expect(drafted.flags[0]).toBe('conf26: screened');
    expect(targets[1]).toEqual({ id: 'conf26', timezone: 'UTC' });
  });

  it('flags a large deadline move', () => {
    const out = apply([entry()], { factsFor: () => facts({ deadline: utc('2026-06-01T23:59:00Z') }) });
    expect(out.flags.some((f) => f.includes('large deadline move'))).toBe(true);
  });
});

describe('bigMoveFlags', () => {
  it('flags moves beyond the threshold and ignores small ones', () => {
    const flags = bigMoveFlags([
      { id: 'conf26', field: 'deadline', old: '2026-01-01 23:59', new: '2026-06-01 23:59' },
      { id: 'conf26', field: 'deadline', old: '2026-01-01 23:59', new: '2026-01-15 23:59' },
      { id: 'conf26', field: 'place', old: 'A', new: 'B' },
      { id: 'conf27', field: 'abstract_deadline', old: null, new: '2026-06-01 23:59' },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatch(/conf26.*large deadline move/);
  });

  it('flags a move away from a hand-authored deadline that carries seconds', () => {
    const flags = bigMoveFlags([
      { id: 'conf26', field: 'deadline', old: '2026-05-25 23:59:00', new: '2026-09-01 23:59' },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatch(/large deadline move/);
  });
});
