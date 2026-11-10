import { describe, it, expect, afterEach, vi } from 'vitest';
import { getCardDeadlines, getDeadlineInfo, getNextDeadline, getNoDeadlineLabel, parseConferences } from '@/utils/parser';
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
  afterEach(() => {
    vi.useRealTimers();
  });

  const info = (deadlines: Conference['deadlines']) =>
    getDeadlineInfo(conf({ timezone: 'UTC-12', deadlines })).map((d) => [d.type, d.label, d.shortLabel, d.key]);

  it('reads deadlines in due order with type labels and legacy keys', () => {
    expect(info([{ type: 'paper', due: '2026-01-28 23:59' }, { type: 'paper_abstract', due: '2026-01-20 23:59' }])).toEqual([
      ['paper_abstract', 'Paper abstract', 'Abstract', 'abstract'],
      ['paper', 'Full paper', 'Paper', 'deadline'],
    ]);
  });

  it('reads due in the entry zone', () => {
    const [d] = getDeadlineInfo(conf({ timezone: 'UTC-12', deadlines: [{ type: 'paper', due: '2026-01-28 23:59' }] }));
    expect(d.datetime.toUTC().toISO()).toBe('2026-01-29T11:59:00.000Z');
  });

  it('uses custom labels and keys new types by name', () => {
    expect(info([
      { type: 'presenter_registration', label: 'Poster presenter registration', due: '2026-10-30 23:59' },
      { type: 'other', label: 'Science Speed Talks video', due: '2026-09-15 23:59' },
    ])).toEqual([
      ['other', 'Science Speed Talks video', 'Science Speed Talks video', 'other-science-speed-talks-video'],
      ['presenter_registration', 'Poster presenter registration', 'Presenter reg.', 'presenter-registration'],
    ]);
  });

  it('keeps keys unique when a base repeats', () => {
    const keys = (deadlines: Conference['deadlines']) => info(deadlines).map((d) => d[3]);
    expect(keys([{ type: 'registration', due: '2026-05-01 23:59' }, { type: 'registration', label: 'Student rate', due: '2026-06-01 23:59' }]))
      .toEqual(['registration', 'registration-student-rate']);
    expect(keys([{ type: 'paper_abstract', due: '2026-05-01 23:59' }, { type: 'abstract', due: '2026-06-01 23:59' }]))
      .toEqual(['abstract-paper-abstract', 'abstract-abstract']);
  });

  it('skips an item of a type it does not know instead of crashing', () => {
    expect(info([{ type: 'camera_ready' as never, due: '2026-01-20 23:59' }, { type: 'paper', due: '2026-01-28 23:59' }]).map((d) => d[0]))
      .toEqual(['paper']);
  });

  it('skips malformed deadlines and a due the YAML loader turned into a Date', () => {
    expect(info([{ type: 'paper', due: 'soon' }])).toEqual([]);
    expect(info([{ type: 'paper', due: new Date('2026-09-15T23:59:00Z') as unknown as string }])).toEqual([]);
  });

  it('counts any type as the next deadline', () => {
    vi.useFakeTimers({ now: new Date('2026-10-01T00:00:00Z') });
    const c = conf({ timezone: 'UTC-12', deadlines: [{ type: 'poster', due: '2026-09-15 23:59' }, { type: 'early_registration', due: '2026-10-14 23:59' }] });
    expect(getNextDeadline(c)?.type).toBe('early_registration');
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
    expect(getNextDeadline(c)?.type).toBe('early_registration');
  });

  it('shows at most max upcoming deadlines on a card, else the latest passed one', () => {
    vi.useFakeTimers({ now: new Date('2026-09-01T00:00:00Z') });
    const day = (d: number) => `2026-09-${String(d).padStart(2, '0')} 23:59`;
    const five = conf({ deadlines: (['poster', 'grant', 'early_registration', 'registration', 'proposal'] as const).map((type, i) => ({ type, due: day(10 + i) })) });
    expect(getCardDeadlines(five, 3)).toMatchObject({ more: 2 });
    expect(getCardDeadlines(five, 3).shown.map((d) => d.type)).toEqual(['poster', 'grant', 'early_registration']);
    vi.setSystemTime(new Date('2026-12-01T00:00:00Z'));
    expect(getCardDeadlines(five, 3).shown.map((d) => d.type)).toEqual(['proposal']);
    expect(getCardDeadlines(conf({}), 3)).toEqual({ shown: [], more: 0 });
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
