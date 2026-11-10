import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DateTime, Settings } from 'luxon';
import { createICSContent, conferenceToICSEvents } from '@/utils/ics';
import type { Conference } from '@/types/conference';

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
  const icml: Conference = {
    id: 'icml26',
    title: 'ICML',
    year: 2026,
    full_name: 'International Conference on Machine Learning',
    sub: ['ML'],
    type: 'conference',
    timezone: 'UTC-12',
    deadlines: [{ type: 'paper_abstract', due: '2026-01-20 23:59' }, { type: 'paper', due: '2026-01-28 23:59' }],
    start: '2026-07-06',
    end: '2026-07-11',
  };

  it('keeps the UIDs of the old kinds and titles events by label', () => {
    const events = conferenceToICSEvents(icml);
    expect(events.map((e) => e.uid)).toEqual([
      'conf-icml26@conference-deadlines', 'abstract-icml26@conference-deadlines', 'deadline-icml26@conference-deadlines',
    ]);
    expect(events[2].start.toUTC().toISO()).toBe('2026-01-29T11:59:00.000Z');
    expect(events.map((e) => e.title)).toEqual(['ICML 2026', 'Paper abstract: ICML 2026', 'Full paper: ICML 2026']);
  });

  it('names the group and label in the description and keys new types by name', () => {
    const [, ev] = conferenceToICSEvents({ ...icml, full_name: 'Geneva Health Forum', deadlines: [{ type: 'early_registration', due: '2026-10-14 23:59' }] });
    expect(ev.uid).toBe('early-registration-icml26@conference-deadlines');
    expect(ev.description).toBe('Registration deadline for Geneva Health Forum: Early-bird registration');
  });
});
