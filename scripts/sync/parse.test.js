import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import {
  parseVenueDateString,
  parseStartDate,
  toZoneString,
  formatDateRange,
  nextId,
  inferEndDate,
} from './parse.js';

const NEURIPS_DATE =
  'Submission Start: Apr 15 2026 12:00PM UTC-0, Abstract Registration: May 05 2026 11:59AM UTC-0, Submission Deadline: May 07 2026 11:59AM UTC-0';

describe('parseVenueDateString', () => {
  it('extracts submission start, abstract and submission deadlines as UTC instants', () => {
    const r = parseVenueDateString(NEURIPS_DATE);
    expect(r.submissionStart.toISO()).toBe('2026-04-15T12:00:00.000Z');
    expect(r.abstractDeadline.toISO()).toBe('2026-05-05T11:59:00.000Z');
    expect(r.deadline.toISO()).toBe('2026-05-07T11:59:00.000Z');
  });

  it('handles a subset of segments and non-zero offsets', () => {
    const r = parseVenueDateString('Submission Deadline: Apr 01 2026 12:15PM UTC-0');
    expect(r.abstractDeadline).toBeUndefined();
    expect(r.deadline.toISO()).toBe('2026-04-01T12:15:00.000Z');
    const shifted = parseVenueDateString('Submission Deadline: Apr 01 2026 12:15PM UTC+2');
    expect(shifted.deadline.toISO()).toBe('2026-04-01T10:15:00.000Z');
  });

  it('returns an empty object for missing or malformed input', () => {
    expect(parseVenueDateString(undefined)).toEqual({});
    expect(parseVenueDateString('')).toEqual({});
    expect(parseVenueDateString('nothing to see here')).toEqual({});
  });
});

describe('parseStartDate', () => {
  it('parses the OpenReview start_date format', () => {
    expect(parseStartDate('Dec 06 2026')).toBe('2026-12-06');
    expect(parseStartDate('Oct 6 2026')).toBe('2026-10-06');
  });
  it('returns null for garbage', () => {
    expect(parseStartDate(undefined)).toBeNull();
    expect(parseStartDate('TBD')).toBeNull();
  });
});

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
