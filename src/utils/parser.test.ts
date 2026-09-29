import { describe, it, expect } from 'vitest';
import { getDeadlineInfo, getNoDeadlineLabel, parseConferences } from '@/utils/parser';
import type { Conference } from '@/types/conference';

function conf(overrides: Partial<Conference>): Conference {
  return {
    id: 'x26',
    title: 'X',
    year: 2026,
    full_name: 'X',
    sub: ['ML'],
    type: 'conference',
    timezone: 'UTC',
    ...overrides,
  };
}

describe('parseConferences', () => {
  const yaml = `
- title: A
  year: 2026
  id: a26
  timezone: UTC
  type: conference
  sub: ML
- title: B
  year: 2026
  id: b26
  timezone: UTC
  type: summit
  full_name: B Summit
  sub: [ML, CV]
- title: C
  year: 2026
  id: c26
  timezone: UTC
  type: workshop
`;

  it('normalizes sub to a list and falls back to General', () => {
    expect(parseConferences(yaml).map((c) => c.sub)).toEqual([['ML'], ['ML', 'CV'], ['General']]);
  });

  it('defaults full_name to the title and leaves other optional fields unset', () => {
    const [a, b] = parseConferences(yaml);
    expect(a.full_name).toBe('A');
    expect(b.full_name).toBe('B Summit');
    expect(a.place).toBeUndefined();
    expect(a.link).toBeUndefined();
    expect(a.note).toBeUndefined();
  });
});

describe('getDeadlineInfo', () => {
  it('lists the abstract then the paper deadline, read in the entry zone', () => {
    const deadlines = getDeadlineInfo(
      conf({ timezone: 'UTC-12', abstract_deadline: '2026-01-20 23:59', deadline: '2026-01-28 23:59' })
    );
    expect(deadlines.map((d) => d.kind)).toEqual(['abstract', 'paper']);
    expect(deadlines.map((d) => d.datetime.toUTC().toISO())).toEqual([
      '2026-01-21T11:59:00.000Z',
      '2026-01-29T11:59:00.000Z',
    ]);
  });

  it('skips missing and malformed deadlines', () => {
    expect(getDeadlineInfo(conf({ deadline: 'soon' }))).toEqual([]);
  });
});

describe('getNoDeadlineLabel', () => {
  it('labels attendance-only events', () => {
    expect(getNoDeadlineLabel(conf({ deadline_status: 'attendance' }))).toBe(
      'Registration only, no submission'
    );
  });

  it('labels events with a deadline still to be announced', () => {
    expect(getNoDeadlineLabel(conf({ deadline_status: 'tba' }))).toBe(
      'Deadline to be announced'
    );
  });

  it('falls back when no deadline status is set', () => {
    expect(getNoDeadlineLabel(conf({}))).toBe('No deadlines on record');
  });
});
