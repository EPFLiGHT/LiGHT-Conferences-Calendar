/**
 * Parsers for the string formats the OpenReview API serves: the venue group's
 * combined `date` string and its `start_date`. Generic date and id helpers
 * live in scripts/sync-shared/dates.js.
 */
import { DateTime } from 'luxon';

// One segment of the venue group's `date` string, e.g.
// "Submission Deadline: May 07 2026 11:59AM UTC-0"
const SEGMENT_RE = /^(.+?):\s+([A-Za-z]{3} \d{1,2} \d{4} \d{1,2}:\d{2}[AP]M) UTC([+-]\d{1,2})$/;

// "Submission Start" is deliberately absent: the sync writes no such field.
const KEY_TO_FIELD = {
  'Abstract Registration': 'abstractDeadline',
  'Submission Deadline': 'deadline',
};

/**
 * Parse an OpenReview venue group's `date` string into UTC instants.
 * @param {string|undefined} dateStr Raw string like
 *   "Submission Start: Apr 15 2026 12:00PM UTC-0, Abstract Registration: ...".
 * @returns {{abstractDeadline?: DateTime, deadline?: DateTime}}
 *   Luxon DateTimes in UTC; keys are omitted when a segment is missing or malformed.
 */
export function parseVenueDateString(dateStr) {
  const result = {};
  if (!dateStr) return result;
  for (const segment of dateStr.split(', ')) {
    const m = segment.trim().match(SEGMENT_RE);
    if (!m) continue;
    const field = KEY_TO_FIELD[m[1].trim()];
    if (!field) continue;
    const dt = DateTime.fromFormat(m[2], 'MMM d yyyy h:mma', {
      zone: `UTC${m[3]}`,
      locale: 'en-US',
    });
    if (dt.isValid) result[field] = dt.toUTC();
  }
  return result;
}

/**
 * Parse an OpenReview `start_date` value like "Dec 06 2026".
 * @param {string|undefined} str Raw start date string.
 * @returns {string|null} ISO date ("2026-12-06"), or null when unparseable.
 */
export function parseStartDate(str) {
  if (!str) return null;
  const dt = DateTime.fromFormat(str.trim(), 'MMM d yyyy', { locale: 'en-US' });
  return dt.isValid ? dt.toISODate() : null;
}
