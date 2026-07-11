/**
 * Date, id and formatting helpers shared by the syncs: render an instant in an
 * entry's timezone, build the human-readable `date` field, and derive a new
 * edition's id and end date. Source-specific parsing lives with its source.
 */
import { DateTime } from 'luxon';

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
 * (sources rarely publish end dates; conference lengths are stable year to year).
 * @param {string} prevStartIso Previous edition's ISO start date.
 * @param {string} prevEndIso Previous edition's ISO end date.
 * @param {string} newStartIso New edition's ISO start date.
 * @returns {string} ISO end date for the new edition.
 */
export function inferEndDate(prevStartIso, prevEndIso, newStartIso) {
  const days = DateTime.fromISO(prevEndIso).diff(DateTime.fromISO(prevStartIso), 'days').days;
  return DateTime.fromISO(newStartIso).plus({ days }).toISODate();
}
