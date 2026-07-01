/**
 * Conference schema: single source of truth for the validation *rules*
 * shared by the runtime parser (src/utils/parser.ts) and the data
 * validator (scripts/validate.js). Reporting (warn vs error) stays local
 * to each caller; only the rules live here so they cannot drift.
 *
 * Plain ESM JavaScript on purpose: scripts/validate.js runs under Node and
 * cannot import TypeScript, and the TS side imports this fine via allowJs.
 */

import { DateTime } from 'luxon';

/** Fields every event must define. */
export const REQUIRED_FIELDS = ['title', 'year', 'id', 'timezone', 'type'];

/** Allowed values for the `type` field. */
export const VALID_TYPES = ['conference', 'summit', 'workshop'];

/** Allowed values for the optional `deadline_status` field. */
export const VALID_DEADLINE_STATUS = ['attendance', 'tba'];

/** Reasonable bounds for the `year` field. */
export const YEAR_MIN = 1900;
export const YEAR_MAX = 2100;

// Datetime fields (deadline, abstract_deadline): "YYYY-MM-DD HH:MM" or "...:SS".
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
// Date-only fields (start, end): "YYYY-MM-DD".
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True if `timezone` is a valid IANA zone. */
export function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || !timezone) return false;
  return DateTime.fromISO('2024-01-01T00:00:00', { zone: timezone }).isValid;
}

/** True if `value` is a well-formed, real datetime string. */
export function isValidDateTime(value) {
  if (typeof value !== 'string' || !DATETIME_RE.test(value)) return false;
  return DateTime.fromISO(value.replace(' ', 'T')).isValid;
}

/** True if `value` is a well-formed, real date-only string. */
export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  return DateTime.fromISO(value).isValid;
}
