/** Conference fixtures for the Slack bot tests. */

import { DateTime } from 'luxon';
import type { Conference, DeadlineInfo } from '@/types/conference';

export function conference(overrides: Partial<Conference> = {}): Conference {
  return {
    id: 'pets25',
    title: 'PETS',
    year: 2026,
    full_name: 'Privacy Enhancing Technologies Symposium',
    sub: ['SEC'],
    type: 'conference',
    timezone: 'UTC',
    place: 'Verona, Italy',
    link: 'https://petsymposium.org',
    ...overrides,
  };
}

export const paperDeadline = (iso = '2026-03-01T23:59:00'): DeadlineInfo => ({
  kind: 'paper',
  label: 'Paper deadline',
  datetime: DateTime.fromISO(iso),
  localDatetime: DateTime.fromISO(iso),
});

export const deadlineItem = (id: string, daysLeft: number) => ({
  conference: conference({ id, title: id.toUpperCase() }),
  deadline: paperDeadline(),
  daysLeft,
});

export const eventItem = (id: string, daysLeft: number) => ({
  conference: conference({ id, title: id.toUpperCase() }),
  start: DateTime.fromISO('2026-06-22T00:00:00'),
  daysLeft,
});

/** Text of every section block. */
export function sectionText(blocks: unknown[]): string {
  return (blocks as Array<{ type: string; text?: { text: string } }>)
    .filter((b) => b.type === 'section')
    .map((b) => b.text?.text ?? '')
    .join('\n');
}
