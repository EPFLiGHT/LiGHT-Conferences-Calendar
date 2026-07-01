import { describe, it, expect } from 'vitest';
import { getNoDeadlineLabel } from '@/utils/parser';
import type { Conference } from '@/types/conference';

function conf(overrides: Partial<Conference>): Conference {
  return {
    id: 'x26',
    title: 'X',
    year: 2026,
    full_name: 'X',
    sub: 'ML',
    type: 'conference',
    timezone: 'UTC',
    ...overrides,
  } as Conference;
}

describe('getNoDeadlineLabel', () => {
  it('labels attendance-only events', () => {
    expect(getNoDeadlineLabel(conf({ deadline_status: 'attendance' }))).toBe(
      'Registration only, no submission'
    );
  });

  it('labels events with a deadline still to be announced', () => {
    expect(getNoDeadlineLabel(conf({ deadline_status: 'tba' }))).toBe(
      'Deadline to be announced'
    );
  });

  it('falls back when no deadline status is set', () => {
    expect(getNoDeadlineLabel(conf({}))).toBe('No deadlines on record');
  });
});
