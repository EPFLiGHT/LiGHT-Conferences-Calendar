import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { formatTimeWithZone, pad2, countLabel } from '@/components/format';

describe('formatTimeWithZone', () => {
  const aoe = DateTime.fromISO('2026-05-01T23:59', { zone: 'UTC-12' });

  it('labels a converted time with the zone it was converted to', () => {
    const local = aoe.setZone('Europe/Zurich');
    expect(formatTimeWithZone(local)).toBe('13:59 Europe/Zurich');
    expect(formatTimeWithZone(local)).not.toContain('UTC-12');
  });

  it('labels an entry time with the entry zone', () => {
    expect(formatTimeWithZone(aoe)).toBe('23:59 UTC-12');
  });
});

describe('pad2', () => {
  it('pads to two digits', () => {
    expect(pad2(0)).toBe('00');
    expect(pad2(7)).toBe('07');
    expect(pad2(12)).toBe('12');
    expect(pad2(123)).toBe('123');
  });
});

describe('countLabel', () => {
  it('pads the count and pluralizes the noun', () => {
    expect(countLabel(0, 'member')).toBe('00 members');
    expect(countLabel(1, 'presentation')).toBe('01 presentation');
    expect(countLabel(14, 'conference')).toBe('14 conferences');
  });
});
