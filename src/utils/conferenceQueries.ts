/**
 * Conference Query Utilities
 *
 * Pure functions extracted from useConferenceFilters hook for reuse in Slack bot.
 */

import { DateTime } from 'luxon';
import { getNextDeadline } from './parser';
import type { Conference, DeadlineInfo } from '@/types/conference';

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
 * Filter conferences by subject
 * Handles both string and array subject fields
 */
export function filterBySubject(
  conferences: Conference[],
  subject: string
): Conference[] {
  return conferences.filter(conf => {
    if (Array.isArray(conf.sub)) {
      return conf.sub.includes(subject);
    }
    return conf.sub === subject;
  });
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
 * Calculate days until deadline
 * Returns positive number for future deadlines, negative for past
 */
export function getDaysUntilDeadline(deadline: DeadlineInfo): number {
  const diff = deadline.localDatetime.diff(DateTime.now(), ['days']);
  return Math.ceil(diff.days);
}

/**
 * Get conferences expiring within N days
 */
export function getDeadlinesWithinDays(
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
