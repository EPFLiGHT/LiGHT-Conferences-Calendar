import { describe, it, expect } from 'vitest';
import {
  isValidTimezone,
  isValidDateTime,
  isValidDate,
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
