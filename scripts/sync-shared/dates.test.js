import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { toZoneString, formatDateRange, nextId, inferEndDate } from './dates.js';

describe('toZoneString', () => {
  it('converts a UTC instant into the entry timezone, AoE style', () => {
    const dt = DateTime.fromISO('2026-05-07T11:59:00Z', { zone: 'utc' });
    expect(toZoneString(dt, 'UTC-12')).toBe('2026-05-06 23:59');
    expect(toZoneString(dt, 'Australia/Sydney')).toBe('2026-05-07 21:59');
  });
});

describe('formatDateRange', () => {
  it('formats same-month, cross-month and cross-year ranges', () => {
    expect(formatDateRange('2026-12-06', '2026-12-12')).toBe('Dec 6-12, 2026');
    expect(formatDateRange('2025-11-30', '2025-12-05')).toBe('Nov 30 - Dec 5, 2025');
    expect(formatDateRange('2026-12-28', '2027-01-02')).toBe('Dec 28, 2026 - Jan 2, 2027');
  });
});

describe('nextId', () => {
  it('replaces the trailing two-digit year', () => {
    expect(nextId('colm26', 2027)).toBe('colm27');
    expect(nextId('neuripssy26', 2027)).toBe('neuripssy27');
  });
});

describe('inferEndDate', () => {
  it('applies the previous edition duration to the new start', () => {
    expect(inferEndDate('2025-12-02', '2025-12-07', '2026-12-06')).toBe('2026-12-11');
  });
});
