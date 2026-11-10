// Rules for an entry in public/data/*.yaml, shared by the web app, scripts/validate.js and the syncs.
// Plain JS so the Node scripts can import it.

import { DateTime } from 'luxon';
import { SUBJECT_CODES } from '../constants/subjects.data.js';
import { DEADLINE_TYPES, DEADLINE_TYPE_CODES } from '../constants/deadlineTypes.data.js';

/** Fields every event must define. */
const REQUIRED_FIELDS = ['title', 'year', 'id', 'timezone', 'type'];

const OPTIONAL_FIELDS = [
  'full_name', 'link', 'deadlines', 'place', 'date',
  'start', 'end', 'paperslink', 'sub', 'note', 'deadline_status', 'sync_pin',
];

/** Fields replaced by `deadlines`; an entry still using one is an error. */
const OLD_DEADLINE_FIELDS = ['deadline', 'abstract_deadline'];

const DEADLINE_ITEM_KEYS = new Set(['type', 'due', 'label', 'pin']);

const KNOWN_FIELDS = new Set([...REQUIRED_FIELDS, ...OPTIONAL_FIELDS]);

/** Allowed values for the `type` field. */
export const VALID_TYPES = ['conference', 'summit', 'workshop'];

/** Allowed values for the optional `deadline_status` field. */
const VALID_DEADLINE_STATUS = ['attendance', 'tba'];

/** Fields a sync may write into an entry, i.e. the ones `sync_pin` accepts. Deadlines pin per item. */
export const SYNC_PINNABLE_FIELDS = ['place', 'start', 'end', 'date'];

const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

// Datetime fields (a deadline's `due`): "YYYY-MM-DD HH:MM" or "...:SS".
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
    if (OLD_DEADLINE_FIELDS.includes(field)) {
      error(`Field '${field}' was replaced by 'deadlines' (a list of {type, due}; see README)`);
    } else if (!KNOWN_FIELDS.has(field)) {
      warning(`Unknown field '${field}'`);
    }
  }

  if (conf.timezone && !isValidTimezone(conf.timezone)) {
    error(`Invalid IANA timezone '${conf.timezone}'`);
  }
  if (conf.deadlines !== undefined) validateDeadlines(conf.deadlines, error);
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
          const hint = OLD_DEADLINE_FIELDS.includes(field) ? '; pin a deadline with pin: true on its item' : '';
          error(`sync_pin field '${field}' is not synced (use one of: ${SYNC_PINNABLE_FIELDS.join(', ')})${hint}`);
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

  if (Array.isArray(conf.deadlines)) {
    const earliest = earliestByType(conf.deadlines);
    if (earliest.paper_abstract > earliest.paper) {
      warning('Paper abstract deadline is after the full paper deadline');
    }
    if (earliest.early_registration > earliest.registration) {
      warning('Early-bird registration closes after registration closes');
    }
    if (conf.deadline_status === 'attendance'
      && conf.deadlines.some((d) => DEADLINE_TYPES[d?.type]?.group === 'submission')) {
      warning("deadline_status is 'attendance' but a submission deadline is listed");
    }
  }

  return issues;
}

/**
 * Check an entry's `deadlines` list and each of its items.
 * @param {unknown} deadlines
 * @param {(message: string) => void} error
 */
function validateDeadlines(deadlines, error) {
  if (!Array.isArray(deadlines) || deadlines.length === 0) {
    error('deadlines must be a non-empty list (omit it when there are none)');
    return;
  }
  const seen = new Set();
  deadlines.forEach((item, i) => {
    const itemError = (message) => error(`deadlines[${i}]: ${message}`);
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      itemError('must be a mapping with type and due');
      return;
    }
    for (const key of Object.keys(item)) {
      if (!DEADLINE_ITEM_KEYS.has(key)) itemError(`unknown key '${key}'`);
    }
    if (!DEADLINE_TYPE_CODES.includes(item.type)) {
      itemError(`unknown type '${item.type}' (use one of: ${DEADLINE_TYPE_CODES.join(', ')})`);
    }
    if (!isValidDateTime(item.due)) {
      itemError(`invalid due ${JSON.stringify(item.due)} (use YYYY-MM-DD HH:MM or YYYY-MM-DD HH:MM:SS)`);
    }
    if (item.label !== undefined && (typeof item.label !== 'string' || !item.label.trim())) {
      itemError('label must be a non-empty string');
    } else if (item.type === 'other' && item.label === undefined) {
      itemError("type 'other' needs a label");
    }
    if (item.pin !== undefined && item.pin !== true) itemError('pin must be true when present');
    const identity = `${item.type}\n${item.label ?? ''}`;
    if (seen.has(identity)) itemError(`a '${item.type}' deadline with this label is already listed`);
    seen.add(identity);
  });
}

/** Earliest due (UTC millis) of each type among the valid items. */
function earliestByType(deadlines) {
  const earliest = {};
  for (const item of deadlines) {
    if (!isValidDateTime(item?.due)) continue;
    const at = parseEntryDateTime(item.due).toMillis();
    if (!(item.type in earliest) || at < earliest[item.type]) earliest[item.type] = at;
  }
  return earliest;
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
