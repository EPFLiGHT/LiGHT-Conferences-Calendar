import { describe, it, expect } from 'vitest';
import { parseVenueDateString, parseStartDate } from './parse.js';

const NEURIPS_DATE =
  'Submission Start: Apr 15 2026 12:00PM UTC-0, Abstract Registration: May 05 2026 11:59AM UTC-0, Submission Deadline: May 07 2026 11:59AM UTC-0';

describe('parseVenueDateString', () => {
  it('extracts the abstract and submission deadlines as UTC instants, ignoring other segments', () => {
    const r = parseVenueDateString(NEURIPS_DATE);
    expect(r.abstractDeadline.toISO()).toBe('2026-05-05T11:59:00.000Z');
    expect(r.deadline.toISO()).toBe('2026-05-07T11:59:00.000Z');
    expect(Object.keys(r).sort()).toEqual(['abstractDeadline', 'deadline']);
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
