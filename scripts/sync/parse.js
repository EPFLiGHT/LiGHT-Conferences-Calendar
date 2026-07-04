/**
 * Pure date/string helpers for the OpenReview sync: parse the deadline and
 * start-date strings served by the OpenReview API, convert UTC instants into
 * an entry's timezone, and derive ids, date ranges and end dates for new
 * editions.
 */
import { DateTime } from 'luxon';

// One segment of the venue group's `date` string, e.g.
// "Submission Deadline: May 07 2026 11:59AM UTC-0"
const SEGMENT_RE = /^(.+?):\s+([A-Za-z]{3} \d{1,2} \d{4} \d{1,2}:\d{2}[AP]M) UTC([+-]\d{1,2})$/;

const KEY_TO_FIELD = {
  'Submission Start': 'submissionStart',
  'Abstract Registration': 'abstractDeadline',
  'Submission Deadline': 'deadline',
};

/**
 * Parse an OpenReview venue group's `date` string into UTC instants.
 * @param {string|undefined} dateStr Raw string like
 *   "Submission Start: Apr 15 2026 12:00PM UTC-0, Abstract Registration: ...".
 * @returns {{submissionStart?: DateTime, abstractDeadline?: DateTime, deadline?: DateTime}}
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

/**
 * Render a UTC instant in the given timezone using the data file's format.
 * @param {DateTime} dt Luxon instant (any zone).
 * @param {string} zone Target zone, IANA ("Australia/Sydney") or fixed offset ("UTC-12").
 * @returns {string} "yyyy-MM-dd HH:mm" in the target zone.
 */
export function toZoneString(dt, zone) {
  return dt.setZone(zone).toFormat('yyyy-MM-dd HH:mm');
}

/**
 * Build the human-readable `date` field from a start/end pair.
 * @param {string} startIso ISO start date.
 * @param {string} endIso ISO end date.
 * @returns {string} e.g. "Dec 6-12, 2026", "Nov 30 - Dec 5, 2025",
 *   or "Dec 28, 2026 - Jan 2, 2027" across a year boundary.
 */
export function formatDateRange(startIso, endIso) {
  const start = DateTime.fromISO(startIso, { locale: 'en-US' });
  const end = DateTime.fromISO(endIso, { locale: 'en-US' });
  if (start.year !== end.year) {
    return `${start.toFormat('MMM d, yyyy')} - ${end.toFormat('MMM d, yyyy')}`;
  }
  if (start.month !== end.month) {
    return `${start.toFormat('MMM d')} - ${end.toFormat('MMM d')}, ${start.year}`;
  }
  return `${start.toFormat('MMM d')}-${end.day}, ${start.year}`;
}

/**
 * Derive a new edition's id from the previous one by swapping the trailing
 * two-digit year ("colm26" -> "colm27").
 * @param {string} prevId Previous edition's id.
 * @param {number} newYear Full year of the new edition.
 * @returns {string} The new id.
 */
export function nextId(prevId, newYear) {
  return prevId.replace(/\d{2}$/, String(newYear).slice(-2));
}

/**
 * Infer an end date by applying the previous edition's duration to a new start
 * (OpenReview only exposes start dates; conference lengths are stable year to year).
 * @param {string} prevStartIso Previous edition's ISO start date.
 * @param {string} prevEndIso Previous edition's ISO end date.
 * @param {string} newStartIso New edition's ISO start date.
 * @returns {string} ISO end date for the new edition.
 */
export function inferEndDate(prevStartIso, prevEndIso, newStartIso) {
  const days = DateTime.fromISO(prevEndIso).diff(DateTime.fromISO(prevStartIso), 'days').days;
  return DateTime.fromISO(newStartIso).plus({ days }).toISODate();
}
