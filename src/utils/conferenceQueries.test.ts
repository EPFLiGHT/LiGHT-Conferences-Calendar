import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DateTime, Settings } from 'luxon';
import {
  getUpcomingEvents,
  getEventStartsOnDays,
  filterDeadlinesByReminders,
} from '@/utils/conferenceQueries';
import type { Conference } from '@/types/conference';

function conf(id: string, start?: string): Conference {
  return {
    id,
    title: id,
    year: 2026,
    full_name: id,
    sub: 'ML',
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
    sub: 'ML',
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
