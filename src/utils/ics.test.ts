import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DateTime, Settings } from 'luxon';
import { createICSContent, conferenceToICSEvents } from '@/utils/ics';

describe('createICSContent', () => {
  let prevZone: typeof Settings.defaultZone;

  // A browser two hours ahead of UTC exporting at 11:00 local time.
  beforeEach(() => {
    prevZone = Settings.defaultZone;
    Settings.defaultZone = 'Europe/Zurich';
    vi.useFakeTimers({ now: new Date('2026-10-02T09:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
    Settings.defaultZone = prevZone;
  });

  it('stamps DTSTAMP with the current UTC time', () => {
    const start = DateTime.fromISO('2026-11-01T12:00:00Z');
    const ics = createICSContent([
      { uid: 'x@test', title: 'X', start, end: start.plus({ hours: 1 }), isAllDay: false },
    ]);
    expect(ics).toContain('DTSTAMP:20261002T090000Z');
  });
});

describe('conferenceToICSEvents', () => {
  it('keeps UIDs and titles stable so re-imported calendars update in place', () => {
    const events = conferenceToICSEvents({
      id: 'icml26',
      title: 'ICML',
      year: 2026,
      full_name: 'International Conference on Machine Learning',
      sub: ['ML'],
      type: 'conference',
      timezone: 'UTC-12',
      abstract_deadline: '2026-01-20 23:59',
      deadline: '2026-01-28 23:59',
      start: '2026-07-06',
      end: '2026-07-11',
    });
    expect(events.map((e) => e.uid)).toEqual([
      'conf-icml26@conference-deadlines',
      'abstract-icml26@conference-deadlines',
      'deadline-icml26@conference-deadlines',
    ]);
    expect(events[2].start.toUTC().toISO()).toBe('2026-01-29T11:59:00.000Z');
    expect(events.map((e) => e.title)).toEqual([
      'ICML 2026',
      'Abstract Deadline: ICML 2026',
      'Paper Deadline: ICML 2026',
    ]);
    expect(events.slice(1).map((e) => e.description)).toEqual([
      'Abstract submission deadline for International Conference on Machine Learning',
      'Paper submission deadline for International Conference on Machine Learning',
    ]);
  });
});
