/**
 * Date, id and formatting helpers shared by the syncs: render an instant in an
 * entry's timezone, build the human-readable `date` field, derive a new
 * edition's id, and tell edition-specific links and finished editions apart.
 * Source-specific parsing lives with its source.
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
 *   "Dec 28, 2026 - Jan 2, 2027" across a year boundary, or "Sep 22, 2027"
 *   for a one-day event.
 */
export function formatDateRange(startIso, endIso) {
  const start = DateTime.fromISO(startIso, { locale: 'en-US' });
  const end = DateTime.fromISO(endIso, { locale: 'en-US' });
  if (startIso === endIso) return start.toFormat('MMM d, yyyy');
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

const yearRe = (year) => new RegExp(`(?<!\\d)(?:${year}|${String(year).slice(-2)})(?!\\d)`);

/**
 * Whether a URL is tied to one edition, e.g. "https://embc.embs.org/2026/" or
 * "https://aime26.aimedicine.info/".
 * @param {string} url
 * @param {number} year Full edition year.
 * @returns {boolean}
 */
export function namesYear(url, year) {
  return yearRe(year).test(url);
}

/**
 * The edition year a URL is tied to: a four-digit year anywhere, or a two-digit
 * one in the host ("aime26."), where a bare number in a path is too ambiguous.
 * @param {string} url
 * @returns {number|null}
 */
export function urlYear(url) {
  const full = url.match(/(?<!\d)20\d{2}(?!\d)/);
  if (full) return Number(full[0]);
  let host;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  const short = host.match(/(?<=[a-z])\d{2}(?=[.-])/i);
  return short ? 2000 + Number(short[0]) : null;
}

/**
 * The URL with its edition year swapped. Only a guess until it is fetched.
 * @param {string} url
 * @param {number} fromYear Full year the URL names.
 * @param {number} toYear Full year to move it to.
 * @returns {string|null} null when the URL does not name fromYear.
 */
export function rollUrl(url, fromYear, toYear) {
  const full = new RegExp(`(?<!\\d)${fromYear}(?!\\d)`, 'g');
  if (full.test(url)) return url.replace(full, String(toYear));
  const u = new URL(url);
  const short = new RegExp(`(?<=[a-z])${String(fromYear).slice(-2)}(?=[.-])`, 'i');
  if (!short.test(u.hostname)) return null;
  u.hostname = u.hostname.replace(short, String(toYear).slice(-2));
  return u.toString();
}

/**
 * Whether an edition is over. Undated (TBA) editions never are.
 * @param {{start?: string, end?: string}} entry
 * @param {DateTime} today
 * @returns {boolean}
 */
export function editionEnded(entry, today) {
  const last = entry.end ?? entry.start;
  return Boolean(last) && last < today.toISODate();
}
