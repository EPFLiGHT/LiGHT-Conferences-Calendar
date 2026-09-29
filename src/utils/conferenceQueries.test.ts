import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DateTime, Settings } from 'luxon';
import {
  getUpcomingEvents,
  getEventStartsOnDays,
  filterDeadlinesByReminders,
  sortConferences,
} from '@/utils/conferenceQueries';
import type { Conference } from '@/types/conference';

function conf(id: string, start?: string): Conference {
  return {
    id,
    title: id,
    year: 2026,
    full_name: id,
    sub: ['ML'],
    type: 'conference',
    ...(start ? { start } : {}),
  } as Conference;
}

// A conference whose paper deadline is `days` out from now (UTC, minute-truncated).
function confDeadlineInDays(id: string, days: number): Conference {
  const deadline = DateTime.now().setZone('utc').plus({ days }).toFormat('yyyy-MM-dd HH:mm');
  return {
    id,
    title: id,
    year: 2026,
    full_name: id,
    sub: ['ML'],
    type: 'conference',
    timezone: 'utc',
    deadline,
  } as Conference;
}

// ISO date string `days` away from today (local), e.g. iso(2) === day after tomorrow.
const iso = (days: number) => DateTime.now().plus({ days }).toISODate() as string;

describe('getUpcomingEvents', () => {
  it('excludes conferences without a start date', () => {
    expect(getUpcomingEvents([conf('no-start')])).toEqual([]);
  });

  it('excludes events whose start is already in the past', () => {
    expect(getUpcomingEvents([conf('past', iso(-5))])).toEqual([]);
  });

  it('includes today and future starts, soonest first', () => {
    const result = getUpcomingEvents([
      conf('far', iso(20)),
      conf('soon', iso(2)),
      conf('today', iso(0)),
    ]);
    expect(result.map((e) => e.conference.id)).toEqual(['today', 'soon', 'far']);
  });

  it('respects the limit', () => {
    const result = getUpcomingEvents(
      [conf('a', iso(1)), conf('b', iso(2)), conf('c', iso(3))],
      2
    );
    expect(result.map((e) => e.conference.id)).toEqual(['a', 'b']);
  });

  it('reports a non-negative daysLeft for upcoming events', () => {
    const [event] = getUpcomingEvents([conf('x', iso(5))]);
    expect(event.daysLeft).toBeGreaterThanOrEqual(0);
  });
});

describe('event start day counts across timezones', () => {
  const ZONES = ['UTC-12', 'America/Los_Angeles', 'America/New_York', 'utc', 'Europe/Paris', 'Asia/Tokyo'];
  let prevZone: typeof Settings.defaultZone;

  // Vercel's daily cron: 09:00 UTC, three days before an Oct 5 start.
  beforeEach(() => {
    prevZone = Settings.defaultZone;
    Settings.defaultZone = 'utc';
    vi.useFakeTimers({ now: new Date('2026-10-02T09:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
    Settings.defaultZone = prevZone;
  });

  const startingOct5 = (timezone: string) =>
    ({ ...conf(timezone, '2026-10-05'), timezone }) as Conference;

  it.each(ZONES)('getEventStartsOnDays matches the 3-day reminder for %s', (zone) => {
    const [event] = getEventStartsOnDays([startingOct5(zone)], [30, 7, 3]);
    expect(event?.daysLeft).toBe(3);
  });

  it.each(ZONES)('getUpcomingEvents reports 3 days left for %s', (zone) => {
    const [event] = getUpcomingEvents([startingOct5(zone)]);
    expect(event?.daysLeft).toBe(3);
  });
});

describe('filterDeadlinesByReminders', () => {
  it('keeps only deadlines that land exactly on a reminder day', () => {
    const result = filterDeadlinesByReminders(
      [
        confDeadlineInDays('on7', 7),
        confDeadlineInDays('off5', 5),
        confDeadlineInDays('on30', 30),
      ],
      [30, 7, 3]
    );
    expect(result.map((r) => r.conference.id).sort()).toEqual(['on30', 'on7']);
  });

  it('returns nothing when no deadline matches a reminder day', () => {
    const result = filterDeadlinesByReminders(
      [confDeadlineInDays('off', 5)],
      [30, 7, 3]
    );
    expect(result).toEqual([]);
  });
});

describe('sortConferences', () => {
  let prevZone: typeof Settings.defaultZone;

  beforeEach(() => {
    prevZone = Settings.defaultZone;
    Settings.defaultZone = 'utc';
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
    Settings.defaultZone = prevZone;
  });

  const event = (id: string, fields: Partial<Conference> = {}) =>
    ({ id, title: id, year: 2026, full_name: id, sub: ['ML'], type: 'conference', timezone: 'utc', ...fields }) as Conference;

  const ids = (list: Conference[]) => list.map((c) => c.id);

  describe('by deadline', () => {
    const upcomingLate = event('upcoming-late', { deadline: '2026-07-01 23:59' });
    const upcomingSoon = event('upcoming-soon', { abstract_deadline: '2026-06-01 23:59', deadline: '2026-06-20 23:59' });
    const ongoing = event('ongoing', { start: '2026-06-10', end: '2026-06-20' });
    const startsAug = event('starts-aug', { start: '2026-08-01' });
    const startsSep = event('starts-sep', { start: '2026-09-01', end: '2026-09-03' });
    const tba2026 = event('tba-2026');
    const tba2027 = event('tba-2027', { year: 2027 });
    const expiredOld = event('expired-old', { deadline: '2026-05-01 23:59' });
    const expiredRecent = event('expired-recent', { deadline: '2026-06-01 23:59' });
    const pastMarch = event('past-march', { start: '2026-03-01', end: '2026-03-03' });
    const pastOctober = event('past-october', { year: 2025, start: '2025-10-01' });
    const past2025 = event('past-2025', { year: 2025 });

    it('ranks upcoming deadlines, then upcoming events, then expired deadlines, then past events', () => {
      const shuffled = [past2025, expiredOld, tba2027, startsSep, upcomingLate, pastMarch, ongoing, tba2026, expiredRecent, startsAug, pastOctober, upcomingSoon];
      expect(ids(sortConferences(shuffled, 'deadline'))).toEqual([
        'upcoming-soon', 'upcoming-late',
        'ongoing', 'starts-aug', 'starts-sep', 'tba-2026', 'tba-2027',
        'expired-recent', 'expired-old',
        'past-march', 'past-october', 'past-2025',
      ]);
    });

    it('puts the nearest upcoming deadline first', () => {
      expect(ids(sortConferences([upcomingLate, upcomingSoon], 'deadline'))).toEqual(['upcoming-soon', 'upcoming-late']);
    });

    it('orders deadline-free upcoming events by start, then year-only entries by year', () => {
      expect(ids(sortConferences([tba2027, startsSep, tba2026, startsAug], 'deadline'))).toEqual([
        'starts-aug', 'starts-sep', 'tba-2026', 'tba-2027',
      ]);
    });

    it('puts the most recently expired deadline first', () => {
      expect(ids(sortConferences([expiredOld, expiredRecent], 'deadline'))).toEqual(['expired-recent', 'expired-old']);
    });

    it('puts the most recent past event first', () => {
      expect(ids(sortConferences([past2025, pastOctober, pastMarch], 'deadline'))).toEqual([
        'past-march', 'past-october', 'past-2025',
      ]);
    });
  });

  it('by start date: latest start first, undated entries last in input order', () => {
    const list = [
      event('undated-a'),
      event('jan', { start: '2026-01-01' }),
      event('undated-b'),
      event('may', { start: '2026-05-01' }),
    ];
    expect(ids(sortConferences(list, 'start'))).toEqual(['may', 'jan', 'undated-a', 'undated-b']);
  });

  it('returns a new array and leaves the input order alone', () => {
    const list = [event('b', { deadline: '2026-07-01 23:59' }), event('a', { deadline: '2026-06-20 23:59' })];
    const sorted = sortConferences(list, 'deadline');
    expect(sorted).not.toBe(list);
    expect(ids(list)).toEqual(['b', 'a']);
  });
});
