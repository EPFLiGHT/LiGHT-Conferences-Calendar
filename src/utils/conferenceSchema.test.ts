import { describe, it, expect } from 'vitest';
import {
  isValidTimezone,
  isValidDateTime,
  isValidDate,
  parseEntryDateTime,
  validateEntry,
  findDuplicateIds,
} from '@/utils/conferenceSchema';

describe('isValidTimezone', () => {
  it('accepts valid IANA zones', () => {
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('America/New_York')).toBe(true);
    expect(isValidTimezone('Europe/Zurich')).toBe(true);
  });

  it('rejects invalid or empty zones', () => {
    expect(isValidTimezone('Not/AZone')).toBe(false);
    expect(isValidTimezone('')).toBe(false);
  });
});

describe('isValidDateTime', () => {
  it('accepts YYYY-MM-DD HH:MM and HH:MM:SS', () => {
    expect(isValidDateTime('2026-01-15 23:59')).toBe(true);
    expect(isValidDateTime('2026-01-15 23:59:00')).toBe(true);
  });

  it('rejects date-only, non-padded, out-of-range, and non-strings', () => {
    expect(isValidDateTime('2026-01-15')).toBe(false);
    expect(isValidDateTime('2026-1-5 9:00')).toBe(false);
    expect(isValidDateTime('2026-13-40 00:00')).toBe(false);
    expect(isValidDateTime(20260115 as unknown as string)).toBe(false);
  });
});

describe('isValidDate', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(isValidDate('2026-06-22')).toBe(true);
  });

  it('rejects datetimes, non-padded, out-of-range, and non-strings', () => {
    expect(isValidDate('2026-06-22 00:00')).toBe(false);
    expect(isValidDate('2026-6-2')).toBe(false);
    expect(isValidDate('2026-13-40')).toBe(false);
    expect(isValidDate(20260622 as unknown as string)).toBe(false);
  });
});

describe('parseEntryDateTime', () => {
  it('reads the data-file format in the given zone', () => {
    const dt = parseEntryDateTime('2026-12-01 23:59', 'UTC-12');
    expect(dt.isValid).toBe(true);
    expect(dt.toUTC().toISO()).toBe('2026-12-02T11:59:00.000Z');
  });

  it('accepts seconds and defaults to UTC', () => {
    expect(parseEntryDateTime('2026-12-01 23:59:30').toISO()).toBe('2026-12-01T23:59:30.000Z');
  });

  it('returns an invalid DateTime for malformed input', () => {
    expect(parseEntryDateTime('Dec 1, 2026').isValid).toBe(false);
  });
});

describe('validateEntry', () => {
  const valid = {
    title: 'ICML',
    year: 2026,
    id: 'icml26',
    timezone: 'UTC-12',
    type: 'conference',
    sub: 'ML',
    abstract_deadline: '2026-01-20 23:59',
    deadline: '2026-01-28 23:59',
    start: '2026-07-06',
    end: '2026-07-11',
    link: 'https://icml.cc',
  };
  const issues = (overrides: Record<string, unknown>) => validateEntry({ ...valid, ...overrides }, 0);
  const errors = (overrides: Record<string, unknown>) =>
    issues(overrides).filter((i) => i.level === 'error').map((i) => i.message);
  const warnings = (overrides: Record<string, unknown>) =>
    issues(overrides).filter((i) => i.level === 'warning').map((i) => i.message);

  it('passes a well-formed entry', () => {
    expect(issues({})).toEqual([]);
  });

  it('warns when the abstract deadline falls after the paper deadline', () => {
    expect(warnings({ abstract_deadline: '2026-12-01 23:59', deadline: '2026-08-03 23:59' })).toEqual([
      'icml26: Abstract deadline is after paper submission deadline',
    ]);
  });

  it('errors on a missing required field, reporting the index when the id is missing', () => {
    expect(errors({ id: undefined })).toContain("conference at index 0: Missing required field 'id'");
  });

  it('errors on invalid timezone, datetime, date, subject, type and year', () => {
    expect(errors({ timezone: 'Mars/Base' })).toHaveLength(1);
    expect(errors({ deadline: '2026-01-28' })).toHaveLength(1);
    expect(errors({ start: '2026-7-6' })).toHaveLength(1);
    expect(errors({ sub: ['ML', 'Astrology'] })).toHaveLength(1);
    expect(errors({ type: 'meetup' })).toHaveLength(1);
    expect(errors({ year: '2026' })).toHaveLength(1);
  });

  it('errors when the event starts after it ends', () => {
    expect(errors({ start: '2026-07-12' })).toEqual(['icml26: Start date is after end date']);
  });

  it('errors on a sync_pin naming a field no sync writes', () => {
    expect(errors({ sync_pin: ['note'] })).toHaveLength(1);
    expect(errors({ sync_pin: ['deadline'] })).toEqual([]);
  });

  it('warns on unknown fields', () => {
    expect(warnings({ hindex: 10, pwclink: 'https://x.org' })).toEqual([
      "icml26: Unknown field 'hindex'",
      "icml26: Unknown field 'pwclink'",
    ]);
  });

  it('warns on an id that is not lowercase or does not end with the year', () => {
    expect(warnings({ id: 'ICML26' })).toEqual(['ICML26: ID should be lowercase']);
    expect(warnings({ id: 'icml25' })).toEqual([
      "icml25: ID should end with '26' (last 2 digits of year 2026)",
    ]);
  });
});

describe('findDuplicateIds', () => {
  it('lists each repeated id once', () => {
    expect(findDuplicateIds(['a26', 'b26', 'a26', 'a26', 'c26'])).toEqual(['a26']);
  });
});
