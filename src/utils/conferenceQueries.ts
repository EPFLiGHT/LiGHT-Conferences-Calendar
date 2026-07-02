/**
 * Conference Query Utilities
 *
 * Pure functions extracted from useConferenceFilters hook for reuse in Slack bot.
 */

import { DateTime } from 'luxon';
import { getNextDeadline } from './parser';
import type { Conference, DeadlineInfo } from '@/types/conference';

/** Whole days from `today` (start-of-day) until `start`, rounded up. */
function daysUntilStart(start: DateTime, today: DateTime): number {
  return Math.ceil(start.startOf('day').diff(today, 'days').days);
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

/**
 * Filter conferences matching any of the given subjects (multi-select).
 * Handles both string and array subject fields; empty list means no filter.
 */
export function filterBySubjects(
  conferences: Conference[],
  subjects: string[]
): Conference[] {
  if (subjects.length === 0) return conferences;
  return conferences.filter(conf => {
    const confSubjects = Array.isArray(conf.sub) ? conf.sub : [conf.sub];
    return confSubjects.some(subject => subjects.includes(subject));
  });
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

/**
 * Get conferences whose event start date is today or in the future.
 * Sorted by soonest start, optionally limited. Mirrors getUpcomingDeadlines
 * but for the event start (conf.start) rather than the submission deadline.
 */
export function getUpcomingEvents(
  conferences: Conference[],
  limit?: number
): Array<{ conference: Conference; start: DateTime; daysLeft: number }> {
  const today = DateTime.now().startOf('day');

  const upcoming = conferences
    .map(conf => {
      if (!conf.start) return null;
      const start = DateTime.fromISO(conf.start, { zone: conf.timezone || 'utc' });
      if (!start.isValid) return null;
      const daysLeft = daysUntilStart(start, today);
      if (daysLeft < 0) return null;
      return { conference: conf, start, daysLeft };
    })
    .filter((item): item is { conference: Conference; start: DateTime; daysLeft: number } =>
      item !== null
    )
    .sort((a, b) => a.start.toMillis() - b.start.toMillis());

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
export function getEventStartsOnDays(
  conferences: Conference[],
  reminderDays: number[]
): Array<{ conference: Conference; start: DateTime; daysLeft: number }> {
  const today = DateTime.now().startOf('day');

  return conferences
    .map(conf => {
      if (!conf.start) return null;
      const start = DateTime.fromISO(conf.start, { zone: conf.timezone || 'utc' });
      if (!start.isValid) return null;
      const daysLeft = daysUntilStart(start, today);
      if (!reminderDays.includes(daysLeft)) return null;
      return { conference: conf, start, daysLeft };
    })
    .filter((item): item is { conference: Conference; start: DateTime; daysLeft: number } => item !== null)
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
