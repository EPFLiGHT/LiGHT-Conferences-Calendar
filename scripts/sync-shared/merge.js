/**
 * Merge rules shared by every sync: decides what a source may write into a
 * conference entry. Only "factual" fields are ever touched (deadline,
 * abstract_deadline, full_name, place, start, end, date); curated fields (sub,
 * type, note, link, paperslink, id, timezone, deadline_status, hindex, pwclink)
 * are protected by construction because they are never passed to the setter.
 * An entry can also pin individual factual fields via `sync_pin` (a list of
 * field names) when a curated value should win over the source, e.g. a venue
 * whose announced deadline differs from the portal cutoff; pinned fields are
 * never written, and any divergence is flagged in the report instead.
 *
 * Sources hand in a `facts` object: {fullName, location, startIso,
 * abstractDeadline, deadline}, with the deadlines as Luxon UTC instants.
 * Building it from a source's payload is the source's own job (see
 * scripts/sync-openreview/facts.js and scripts/sync-llm/facts.js).
 */
import { toZoneString, formatDateRange, nextId, inferEndDate } from './dates.js';

/** Fields a sync may write into an entry, i.e. the ones `sync_pin` accepts. */
export const SYNC_PINNABLE_FIELDS = [
  'deadline', 'abstract_deadline', 'full_name', 'place', 'start', 'end', 'date',
];

/**
 * Apply facts to an existing entry, mutating it in place. Deadlines are
 * rendered in the entry's own timezone. When the start moves, the end is
 * shifted by the same delta and flagged; when the source's start year does
 * not match the edition year (upstream typo), start/end/date are left
 * untouched and flagged instead.
 * @param {object} entry A conferences.yaml entry (mutated).
 * @param {object} facts Facts from the source's own facts builder.
 * @param {{deadlinesOnly?: boolean}} [opts] deadlinesOnly restricts writes to
 *   deadline fields, used for venues split into one entry per location.
 * @returns {{changes: Array<{id: string, field: string, old: string|null, new: string}>, flags: string[]}}
 *   The field-level changes made and any items needing human attention.
 */
export function updateEntry(entry, facts, { deadlinesOnly = false } = {}) {
  const changes = [];
  const flags = [];
  const pinned = new Set(entry.sync_pin ?? []);
  // Returns whether the field was actually written, so callers can avoid
  // deriving other fields from a value a pin rejected.
  const set = (field, next) => {
    if (next == null) return false;
    const old = entry[field];
    if (old === next) return false;
    if (pinned.has(field)) {
      flags.push(`${entry.id}: ${field} pinned; source reports ${next}`);
      return false;
    }
    entry[field] = next;
    changes.push({ id: entry.id, field, old: old ?? null, new: next });
    return true;
  };

  set('deadline', facts.deadline && toZoneString(facts.deadline, entry.timezone));
  set('abstract_deadline', facts.abstractDeadline && toZoneString(facts.abstractDeadline, entry.timezone));

  if (!deadlinesOnly) {
    set('full_name', facts.fullName);
    set('place', facts.location);
    if (facts.startIso && facts.startIso !== entry.start) {
      const startYear = Number(facts.startIso.slice(0, 4));
      if (startYear !== entry.year) {
        flags.push(
          `${entry.id}: source start date ${facts.startIso} is in year ${startYear} but the edition year is ${entry.year}; start/end/date left untouched`,
        );
      } else {
        const oldStart = entry.start;
        const mustShiftEnd = Boolean(oldStart && entry.end);
        if (pinned.has('start')) {
          flags.push(`${entry.id}: start pinned; source reports ${facts.startIso}`);
        } else if (mustShiftEnd && pinned.has('end')) {
          flags.push(
            `${entry.id}: source moved start to ${facts.startIso} but end is pinned; start, end and date left untouched, fix them by hand`,
          );
        } else {
          set('start', facts.startIso);
          if (mustShiftEnd && set('end', inferEndDate(oldStart, entry.end, facts.startIso))) {
            flags.push(
              `${entry.id}: end shifted to keep the previous duration after start moved; verify against the venue site`,
            );
          }
          if (entry.start && entry.end) {
            set('date', formatDateRange(entry.start, entry.end));
          }
        }
      }
    }
  }
  return { changes, flags };
}

// Fields that are edition-specific and would be stale on a cloned draft
// (sync_pin included: a pin records a judgment about one edition's data).
const DRAFT_DROPPED_FIELDS = ['note', 'paperslink', 'deadline_status', 'sync_pin'];

/**
 * Draft a new edition by cloning the previous one and overwriting it with
 * facts. Curated fields (sub, type, timezone, link) carry over from the clone;
 * edition-specific fields (note, paperslink, deadline_status) are dropped; the
 * end date is inferred from the previous edition's duration and flagged.
 * @param {object} prevEntry The venue's latest existing entry (not mutated).
 * @param {object} facts Facts from the source's own facts builder.
 * @param {number} year Edition year of the draft.
 * @returns {{entry: object, flags: string[]}} The drafted entry and the
 *   attention items (inferred/missing dates, year mismatches).
 */
export function draftEntry(prevEntry, facts, year) {
  const entry = { ...prevEntry };
  const flags = [];
  for (const field of DRAFT_DROPPED_FIELDS) delete entry[field];
  entry.year = year;
  entry.id = nextId(prevEntry.id, year);

  if (facts.fullName) entry.full_name = facts.fullName;
  if (facts.location) entry.place = facts.location;
  else flags.push(`place kept from ${prevEntry.id}; the source has none yet`);

  // Assigning to an existing key keeps its position in the dumped YAML;
  // only delete when the fact is absent.
  if (facts.abstractDeadline) {
    entry.abstract_deadline = toZoneString(facts.abstractDeadline, entry.timezone);
  } else {
    delete entry.abstract_deadline;
  }
  if (facts.deadline) {
    entry.deadline = toZoneString(facts.deadline, entry.timezone);
  } else {
    delete entry.deadline;
    flags.push('no submission deadline from the source yet');
  }

  let startIso = facts.startIso;
  if (startIso) {
    const startYear = Number(startIso.slice(0, 4));
    if (startYear !== year) {
      flags.push(
        `source start date ${startIso} is in year ${startYear} but the edition year is ${year}; start, end and date left unset`,
      );
      startIso = null;
    }
  }

  if (startIso) {
    entry.start = startIso;
    if (prevEntry.start && prevEntry.end) {
      entry.end = inferEndDate(prevEntry.start, prevEntry.end, startIso);
      entry.date = formatDateRange(entry.start, entry.end);
      flags.push(`end date inferred from ${prevEntry.id} duration; verify against the venue site`);
    } else {
      delete entry.end;
      delete entry.date;
      flags.push('no previous duration to infer end date from; set end and date manually');
    }
  } else {
    delete entry.start;
    delete entry.end;
    delete entry.date;
    if (!facts.startIso) {
      flags.push('no start date from the source yet; set start, end and date manually');
    }
  }
  return { entry, flags };
}
