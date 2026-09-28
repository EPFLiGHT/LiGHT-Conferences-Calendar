import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { toZoneString, formatDateRange, nextId, namesYear, rollUrl, urlYear, editionEnded } from './dates.js';

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

  it('formats a one-day event as a single date', () => {
    expect(formatDateRange('2027-09-22', '2027-09-22')).toBe('Sep 22, 2027');
  });
});

describe('nextId', () => {
  it('replaces the trailing two-digit year', () => {
    expect(nextId('colm26', 2027)).toBe('colm27');
    expect(nextId('neuripssy26', 2027)).toBe('neuripssy27');
  });
});

describe('namesYear', () => {
  it('finds a four-digit or two-digit year that is not part of a longer number', () => {
    expect(namesYear('https://embc.embs.org/2026/', 2026)).toBe(true);
    expect(namesYear('https://aime26.aimedicine.info/', 2026)).toBe(true);
    expect(namesYear('https://neurips.cc/', 2026)).toBe(false);
    expect(namesYear('https://example.org/?p=1260', 2026)).toBe(false);
  });
});

describe('urlYear', () => {
  it('reads a four-digit year anywhere, a two-digit one only in the host', () => {
    expect(urlYear('https://conferences.miccai.org/2026/en/IMPORTANT-DATES.html')).toBe(2026);
    expect(urlYear('https://aime26.aimedicine.info/call-for-papers/')).toBe(2026);
    expect(urlYear('https://psb.stanford.edu/keydates')).toBeNull();
    expect(urlYear('https://example.org/page/26')).toBeNull();
  });
});

describe('rollUrl', () => {
  it('moves the edition year in the path or the host', () => {
    expect(rollUrl('https://embc.embs.org/2026/', 2026, 2027)).toBe('https://embc.embs.org/2027/');
    expect(rollUrl('https://www.gdhf.digital/abstracts2026', 2026, 2027)).toBe('https://www.gdhf.digital/abstracts2027');
    expect(rollUrl('https://aime26.aimedicine.info/call-for-papers/', 2026, 2027)).toBe('https://aime27.aimedicine.info/call-for-papers/');
  });

  it('returns null when the URL names no year', () => {
    expect(rollUrl('https://neurips.cc/', 2026, 2027)).toBeNull();
  });
});

describe('editionEnded', () => {
  const today = DateTime.fromISO('2026-09-28T12:00:00Z', { zone: 'utc' });
  it('compares the last conference day, or the start when there is no end', () => {
    expect(editionEnded({ start: '2026-08-12', end: '2026-08-13' }, today)).toBe(true);
    expect(editionEnded({ start: '2026-09-27', end: '2026-10-01' }, today)).toBe(false);
    expect(editionEnded({ start: '2026-09-01' }, today)).toBe(true);
    expect(editionEnded({}, today)).toBe(false);
  });
});
