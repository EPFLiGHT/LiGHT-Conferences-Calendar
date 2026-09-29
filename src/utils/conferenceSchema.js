// Rules for an entry in public/data/*.yaml, shared by the web app, scripts/validate.js and the syncs.
// Plain JS so the Node scripts can import it.

import { DateTime } from 'luxon';
import { SUBJECT_CODES } from '../constants/subjects.data.js';

/** Fields every event must define. */
const REQUIRED_FIELDS = ['title', 'year', 'id', 'timezone', 'type'];

const OPTIONAL_FIELDS = [
  'full_name', 'link', 'deadline', 'abstract_deadline', 'place', 'date',
  'start', 'end', 'paperslink', 'sub', 'note', 'deadline_status', 'sync_pin',
];

const KNOWN_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

/** Allowed values for the `type` field. */
export const VALID_TYPES = ['conference', 'summit', 'workshop'];

/** Allowed values for the optional `deadline_status` field. */
const VALID_DEADLINE_STATUS = ['attendance', 'tba'];

/** Fields a sync may write into an entry, i.e. the ones `sync_pin` accepts. */
export const SYNC_PINNABLE_FIELDS = [
  'deadline', 'abstract_deadline', 'place', 'start', 'end', 'date',
];

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

// Datetime fields (deadline, abstract_deadline): "YYYY-MM-DD HH:MM" or "...:SS".
const DATETIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
// Date-only fields (start, end): "YYYY-MM-DD".
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Read a datetime field ("YYYY-MM-DD HH:mm[:ss]") as a Luxon DateTime.
 * @param {string} value
 * @param {string} [zone] IANA zone or fixed offset such as "UTC-12".
 * @returns {DateTime} Invalid when `value` is malformed.
 */
export function parseEntryDateTime(value, zone = 'utc') {
  return DateTime.fromISO(value.replace(' ', 'T'), { zone });
}

/** True if `timezone` is a valid IANA zone. */
export function isValidTimezone(timezone) {
  if (typeof timezone !== 'string' || !timezone) return false;
  return DateTime.fromISO('2024-01-01T00:00:00', { zone: timezone }).isValid;
}

/** True if `value` is a well-formed, real datetime string. */
export function isValidDateTime(value) {
  if (typeof value !== 'string' || !DATETIME_RE.test(value)) return false;
  return parseEntryDateTime(value).isValid;
}

/** True if `value` is a well-formed, real date-only string. */
export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  return DateTime.fromISO(value).isValid;
}

/**
 * Check one entry against the schema.
 * @param {Record<string, unknown>} conf A raw YAML entry.
 * @param {number} index Its position in the file, named when the id is missing.
 * @returns {Array<{level: 'error'|'warning', message: string}>}
 */
export function validateEntry(conf, index) {
  const issues = [];
  const confId = conf.id || `conference at index ${index}`;
  const error = (message) => issues.push({ level: 'error', message: `${confId}: ${message}` });
  const warning = (message) => issues.push({ level: 'warning', message: `${confId}: ${message}` });

  for (const field of REQUIRED_FIELDS) {
    if (!conf[field]) error(`Missing required field '${field}'`);
  }
  for (const field of Object.keys(conf)) {
    if (!KNOWN_FIELDS.has(field)) warning(`Unknown field '${field}'`);
  }

  if (conf.timezone && !isValidTimezone(conf.timezone)) {
    error(`Invalid IANA timezone '${conf.timezone}'`);
  }
  for (const field of ['deadline', 'abstract_deadline']) {
    if (conf[field] && !isValidDateTime(conf[field])) {
      error(`Invalid datetime for '${field}': ${JSON.stringify(conf[field])} (use YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM)`);
    }
  }
  for (const field of ['start', 'end']) {
    if (conf[field] && !isValidDate(conf[field])) {
      error(`Invalid date for '${field}': ${JSON.stringify(conf[field])} (use YYYY-MM-DD)`);
    }
  }

  if (conf.deadline_status && !VALID_DEADLINE_STATUS.includes(conf.deadline_status)) {
    error(`Invalid deadline_status '${conf.deadline_status}' (use one of: ${VALID_DEADLINE_STATUS.join(', ')})`);
  }

  if (conf.sync_pin !== undefined) {
    if (!Array.isArray(conf.sync_pin) || conf.sync_pin.length === 0) {
      error('sync_pin must be a non-empty array of field names');
    } else {
      for (const field of conf.sync_pin) {
        if (!SYNC_PINNABLE_FIELDS.includes(field)) {
          error(`sync_pin field '${field}' is not synced (use one of: ${SYNC_PINNABLE_FIELDS.join(', ')})`);
        }
      }
    }
  }

  if (conf.year) {
    if (typeof conf.year !== 'number') {
      error(`Year must be a number, got ${typeof conf.year}`);
    } else if (conf.year < YEAR_MIN || conf.year > YEAR_MAX) {
      error(`Year '${conf.year}' is out of reasonable range`);
    }
  }

  if (conf.sub) {
    for (const subject of [conf.sub].flat()) {
      if (!SUBJECT_CODES.includes(subject)) {
        error(`Invalid subject tag '${subject}'. Must be one of: ${SUBJECT_CODES.join(', ')}`);
      }
    }
  }

  if (conf.type && !VALID_TYPES.includes(conf.type)) {
    error(`Invalid type '${conf.type}'. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  if (typeof conf.id === 'string' && typeof conf.year === 'number') {
    const expectedSuffix = String(conf.year).slice(-2);
    if (!conf.id.endsWith(expectedSuffix)) {
      warning(`ID should end with '${expectedSuffix}' (last 2 digits of year ${conf.year})`);
    }
    if (conf.id !== conf.id.toLowerCase()) warning('ID should be lowercase');
  }

  for (const field of ['link', 'paperslink']) {
    const value = conf[field];
    if (typeof value !== 'string' || !value) continue;
    try {
      new URL(value.startsWith('http') ? value : `https://${value}`);
    } catch {
      warning(`Invalid URL for '${field}': ${value}`);
    }
  }

  if (isValidDate(conf.start) && isValidDate(conf.end) && conf.start > conf.end) {
    error('Start date is after end date');
  }

  if (isValidDateTime(conf.abstract_deadline) && isValidDateTime(conf.deadline)) {
    const abstract = parseEntryDateTime(conf.abstract_deadline);
    const paper = parseEntryDateTime(conf.deadline);
    if (abstract > paper) warning('Abstract deadline is after paper submission deadline');
  }

  return issues;
}

/**
 * Ids that occur more than once, each listed once.
 * @param {string[]} ids
 * @returns {string[]}
 */
export function findDuplicateIds(ids) {
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}
