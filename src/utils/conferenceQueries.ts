/** Pure conference queries shared by the web app and the Slack bot. */

import { DateTime } from 'luxon';
import { getNextDeadline } from './parser';
import type { Conference, DeadlineInfo } from '@/types/conference';

/** Calendar days from `today` until `start`, compared as wall-clock dates. */
function daysUntilStart(start: DateTime, today: DateTime): number {
  const asDate = (dt: DateTime) => dt.setZone('utc', { keepLocalTime: true }).startOf('day');
  return asDate(start).diff(asDate(today), 'days').days;
}

/**
 * Search conferences by title, year, or full name
 * Case-insensitive, whitespace-insensitive matching
 */
export function searchConferences(
  conferences: Conference[],
  query: string
): Conference[] {
  if (!query) return conferences;

  const q = query.toLowerCase().replace(/\s+/g, '');
  return conferences.filter(conf => {
    const searchableText = `${conf.title}${conf.year}${conf.full_name}`
      .toLowerCase()
      .replace(/\s+/g, '');
    return searchableText.includes(q);
  });
}

/** Conferences tagged with any of the given subjects; an empty list keeps all. */
export function filterBySubjects(
  conferences: Conference[],
  subjects: string[]
): Conference[] {
  if (subjects.length === 0) return conferences;
  return conferences.filter(conf => conf.sub.some(subject => subjects.includes(subject)));
}

/**
 * Filter conferences by a single subject
 */
export function filterBySubject(
  conferences: Conference[],
  subject: string
): Conference[] {
  return filterBySubjects(conferences, [subject]);
}

/**
 * Get conferences with upcoming deadlines (not expired)
 * Sorted by nearness, optionally limited
 */
export function getUpcomingDeadlines(
  conferences: Conference[],
  limit?: number
): Array<{ conference: Conference; deadline: DeadlineInfo }> {
  const now = DateTime.now();

  const upcoming = conferences
    .map(conf => ({ conference: conf, deadline: getNextDeadline(conf) }))
    .filter((item): item is { conference: Conference; deadline: DeadlineInfo } =>
      item.deadline !== null && item.deadline.localDatetime > now
    )
    .sort((a, b) => a.deadline.datetime.toMillis() - b.deadline.datetime.toMillis());

  return limit ? upcoming.slice(0, limit) : upcoming;
}

type EventStart = { conference: Conference; start: DateTime; daysLeft: number };

/** Events starting today or later, with the days left until their start. */
function futureEventStarts(conferences: Conference[]): EventStart[] {
  const today = DateTime.now().startOf('day');
  return conferences.flatMap(conf => {
    if (!conf.start) return [];
    const start = DateTime.fromISO(conf.start, { zone: conf.timezone || 'utc' });
    if (!start.isValid) return [];
    const daysLeft = daysUntilStart(start, today);
    return daysLeft < 0 ? [] : [{ conference: conf, start, daysLeft }];
  });
}

/** Events starting today or later, soonest first, optionally limited. */
export function getUpcomingEvents(conferences: Conference[], limit?: number): EventStart[] {
  const upcoming = futureEventStarts(conferences).sort((a, b) => a.start.toMillis() - b.start.toMillis());
  return limit ? upcoming.slice(0, limit) : upcoming;
}

/**
 * Calculate days until deadline
 * Returns positive number for future deadlines, negative for past
 */
export function getDaysUntilDeadline(deadline: DeadlineInfo): number {
  const diff = deadline.localDatetime.diff(DateTime.now(), ['days']);
  return Math.ceil(diff.days);
}

/**
 * Get conferences whose event start date falls exactly on one of the given
 * reminder-day offsets from today (e.g. 30, 7, 3 days out). Used for
 * "event is starting soon" reminders, separate from submission deadlines.
 */
export function getEventStartsOnDays(conferences: Conference[], reminderDays: number[]): EventStart[] {
  return futureEventStarts(conferences)
    .filter(item => reminderDays.includes(item.daysLeft))
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Get conferences expiring within N days
 */
function getDeadlinesWithinDays(
  conferences: Conference[],
  days: number
): Array<{ conference: Conference; deadline: DeadlineInfo; daysLeft: number }> {
  const now = DateTime.now();

  return conferences
    .map(conf => {
      const deadline = getNextDeadline(conf);
      if (!deadline || deadline.localDatetime <= now) return null;

      const daysLeft = getDaysUntilDeadline(deadline);
      if (daysLeft > days) return null;

      return { conference: conf, deadline, daysLeft };
    })
    .filter((item): item is { conference: Conference; deadline: DeadlineInfo; daysLeft: number } => item !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

/**
 * Deadlines that land exactly on one of the given reminder-day offsets
 * (e.g. 30, 7, 3 days out). Shared by the user-DM and channel crons so both
 * fire on the same cadence and never re-post the same item on consecutive days.
 */
export function filterDeadlinesByReminders(
  conferences: Conference[],
  reminderDays: number[]
): Array<{ conference: Conference; deadline: DeadlineInfo; daysLeft: number }> {
  const maxReminderDays = Math.max(...reminderDays);
  return getDeadlinesWithinDays(conferences, maxReminderDays).filter(item =>
    reminderDays.includes(item.daysLeft)
  );
}

export type SortBy = 'deadline' | 'start';

// Year-only entries fall back to their year's bounds, so a 2027-only entry still counts as future.

function eventStartMs(c: Conference): number {
  if (c.start) return DateTime.fromISO(c.start).toMillis();
  if (c.end) return DateTime.fromISO(c.end).toMillis();
  return DateTime.fromObject({ year: c.year }).toMillis();
}

function eventEndMs(c: Conference): number {
  const last = c.end || c.start;
  if (last) return DateTime.fromISO(last).endOf('day').toMillis();
  return DateTime.fromObject({ year: c.year }).endOf('year').toMillis();
}

/**
 * Sorted copy. `deadline`: upcoming deadlines (nearest first), deadline-free events not yet over,
 * expired deadlines (latest first), past events (latest first). `start`: latest start first, undated last.
 */
export function sortConferences(conferences: Conference[], sortBy: SortBy): Conference[] {
  if (sortBy === 'start') {
    const startMs = (c: Conference) => (c.start ? DateTime.fromISO(c.start).toMillis() : 0);
    return [...conferences].sort((a, b) => startMs(b) - startMs(a));
  }

  const now = DateTime.now();
  const ranked = conferences.map((conference) => {
    const next = getNextDeadline(conference);
    const tier = next
      ? (next.localDatetime > now ? 0 : 2)
      : (eventEndMs(conference) >= now.toMillis() ? 1 : 3);
    return { conference, next, tier };
  });

  ranked.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    switch (a.tier) {
      case 0:
        return a.next!.datetime.toMillis() - b.next!.datetime.toMillis();
      case 1: {
        const aTBA = !a.conference.start && !a.conference.end;
        const bTBA = !b.conference.start && !b.conference.end;
        if (aTBA !== bTBA) return aTBA ? 1 : -1;
        if (aTBA) return a.conference.year - b.conference.year;
        return eventStartMs(a.conference) - eventStartMs(b.conference);
      }
      case 2:
        return b.next!.datetime.toMillis() - a.next!.datetime.toMillis();
      default:
        return eventStartMs(b.conference) - eventStartMs(a.conference);
    }
  });
  return ranked.map((r) => r.conference);
}
