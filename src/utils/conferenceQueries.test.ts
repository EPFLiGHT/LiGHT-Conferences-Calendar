import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { getUpcomingEvents } from '@/utils/conferenceQueries';
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
