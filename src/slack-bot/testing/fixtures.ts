/** Conference fixtures for the Slack bot tests. */

import { DateTime } from 'luxon';
import type { DeadlineType } from '@/constants/deadlineTypes';
import type { Conference, DeadlineInfo } from '@/types/conference';
import { getDeadlineInfo } from '@/utils/parser';

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
  key: 'deadline',
  type: 'paper',
  group: 'submission',
  label: 'Full paper',
  shortLabel: 'Paper',
  datetime: DateTime.fromISO(iso),
  localDatetime: DateTime.fromISO(iso),
});

export const deadlineItem = (id: string, daysLeft: number) => ({
  conference: conference({ id, title: id.toUpperCase() }),
  deadline: paperDeadline(),
  daysLeft,
});

/** The DeadlineInfo of a one-item UTC-12 conference. */
export const deadlineInfo = (type: DeadlineType, due = '2026-09-15 23:59'): DeadlineInfo =>
  getDeadlineInfo(conference({ timezone: 'UTC-12', deadlines: [{ type, due }] }))[0];

export const typedDeadlineItem = (conf: Conference, type: DeadlineType, daysLeft: number) => ({
  conference: conf,
  deadline: deadlineInfo(type),
  daysLeft,
});

/** A one-deadline card item. */
export const deadlineCard = (id: string, daysLeft: number) => {
  const { conference: conf, deadline } = deadlineItem(id, daysLeft);
  return { kind: 'deadline' as const, conference: conf, deadlines: [{ deadline, daysLeft }] };
};

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
