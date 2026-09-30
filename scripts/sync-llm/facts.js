/**
 * Turns a validated edition (see gates.js) into the facts object
 * scripts/sync-shared/merge.js consumes, reading each deadline in the timezone
 * the page names or, failing that, the entry's own.
 */
import { DateTime } from 'luxon';

const AOE_RE = /aoe|anywhere\s+on\s+earth/i;

// Only the abbreviations Luxon gets wrong. It rejects the daylight ones
// outright, and resolves "BST" to UTC+6 (Bangladesh) when a page writing it
// means British Summer Time. Everything else it already handles, including the
// standard-time names that a summer date must resolve through DST ("CET" in
// July is CEST), so listing those here would pin them an hour off.
const FIXED_OFFSETS = {
  edt: 'UTC-4', cdt: 'UTC-5', mdt: 'UTC-6', pdt: 'UTC-7',
  cest: 'UTC+2', bst: 'UTC+1', aest: 'UTC+10', aedt: 'UTC+11',
};

// The US names pages actually write, mapped to locations rather than offsets
// so the date itself decides DST ("ET" in July is UTC-4, in December UTC-5).
// Matched whole, with an optional trailing "time": "Central European Time"
// must fall through to Luxon, not read as US Central.
const NAMED_ZONES = {
  pt: 'America/Los_Angeles', pacific: 'America/Los_Angeles',
  et: 'America/New_York', eastern: 'America/New_York',
  ct: 'America/Chicago', central: 'America/Chicago',
  mt: 'America/Denver', mountain: 'America/Denver',
};

/**
 * Resolve a timezone as written on a page. Returns null rather than guessing,
 * so the caller can flag the deadline instead of silently storing it hours off.
 * @param {string|null} timezoneText Timezone exactly as written on the page.
 * @returns {string|null} A zone Luxon accepts, or null when unrecognized.
 */
export function resolveZone(timezoneText) {
  if (!timezoneText) return null;
  const candidate = timezoneText.trim();
  if (AOE_RE.test(candidate)) return 'UTC-12';
  const key = candidate.toLowerCase();
  const mapped = FIXED_OFFSETS[key] ?? NAMED_ZONES[key.replace(/\s+time$/, '')];
  if (mapped) return mapped;
  return DateTime.now().setZone(candidate).isValid ? candidate : null;
}

/**
 * @param {{date: string, time: string|null, timezone_text: string|null}} d
 * @param {string} entryTimezone Fallback when the page names no usable zone.
 * @returns {DateTime|null} UTC instant, or null when unparseable.
 */
export function parseDeadline({ date, time, timezone_text }, entryTimezone) {
  const zone = resolveZone(timezone_text) ?? entryTimezone;
  const dt = DateTime.fromISO(`${date}T${time ?? '23:59'}`, { zone });
  return dt.isValid ? dt.toUTC() : null;
}

/**
 * Convert a validated edition into the facts shape the merge layer consumes.
 * @param {object} edition Validated edition.
 * @param {string} entryTimezone The matched entry's timezone field.
 * @returns {{fullName: string|null, location: string|null, startIso: string|null,
 *   endIso: string|null, abstractDeadline: DateTime|null, deadline: DateTime|null}}
 */
export function editionToFacts(edition, entryTimezone) {
  const byKind = (kind) => edition.deadlines.find((d) => d.kind === kind);
  const abstract = byKind('abstract');
  const paper = byKind('paper');
  return {
    fullName: edition.full_name || null,
    location: edition.location || null,
    startIso: edition.start_date || null,
    endIso: edition.end_date || null,
    abstractDeadline: abstract ? parseDeadline(abstract, entryTimezone) : null,
    deadline: paper ? parseDeadline(paper, entryTimezone) : null,
  };
}
