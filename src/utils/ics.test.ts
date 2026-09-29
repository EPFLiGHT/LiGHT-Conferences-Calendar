import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DateTime, Settings } from 'luxon';
import { createICSContent } from '@/utils/ics';

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
