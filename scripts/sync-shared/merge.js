/**
 * Merge rules shared by every sync: decides what a source may write into a
 * conference entry. Only "factual" fields are ever touched (deadline,
 * abstract_deadline, start, end, date, and place and full_name when the entry
 * has none); curated fields (sub, type, note, link, paperslink, id, timezone,
 * deadline_status) are protected by construction because they are never passed
 * to the setter. A value the source does not state is left
 * alone, never derived from the old one.
 * An entry can also pin individual factual fields via `sync_pin` (a list of
 * field names) when a curated value should win over the source, e.g. a venue
 * whose announced deadline differs from the portal cutoff; pinned fields are
 * never written, and any divergence is flagged in the report instead.
 *
 * full_name passes through the gate in names.js and is only filled when
 * missing or drafted; a curated one is kept, and flagged when the source's
 * core name differs.
 *
 * Sources hand in a `facts` object: {fullName, location, startIso, endIso,
 * link, abstractDeadline, deadline}, with the deadlines as Luxon UTC instants;
 * endIso and link are optional.
 * Building it from a source's payload is the source's own job (see
 * scripts/sync-openreview/facts.js and scripts/sync-llm/facts.js).
 */
import { parseEntryDateTime } from '../../src/utils/conferenceSchema.js';
import { toZoneString, formatDateRange, nextId, namesYear } from './dates.js';
import { cleanFullName, sameConferenceName } from './names.js';

/**
 * The curated place and the source's name one city when a curated segment
 * other than the country appears in the source's string: "Boston,
 * Massachusetts, USA" and "Northeastern University, Boston" agree, while
 * "Paris, France" and "Lyon, France" do not.
 */
function samePlace(curated, reported) {
  const parts = curated.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean);
  const local = parts.length > 1 ? parts.slice(0, -1) : parts;
  const haystack = reported.toLowerCase();
  return local.some((p) => haystack.includes(p));
}

/**
 * Apply facts to an existing entry, mutating it in place. Deadlines are
 * rendered in the entry's own timezone. Start, end and date move only as far
 * as the source states them: a moved start with no stated end is flagged, not
 * shifted, and a source start in another year than the edition (upstream
 * typo) is flagged too. A curated place is kept; a source naming another city
 * is flagged.
 * @param {object} entry A conferences.yaml entry (mutated).
 * @param {object} facts Facts from the source's own facts builder.
 * @param {{deadlinesOnly?: boolean, today?: DateTime}} [opts] deadlinesOnly
 *   restricts writes to deadline fields, used for venues split into one entry
 *   per location. With today, a deadline whose old and new values have both
 *   passed is left alone.
 * @returns {{changes: Array<{id: string, field: string, old: string|null, new: string}>, flags: string[]}}
 *   The field-level changes made and any items needing human attention.
 */
export function updateEntry(entry, facts, opts = {}) {
  const changes = [];
  const flags = [];
  const { deadlinesOnly = false, today = null } = opts;
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

  const setDeadline = (field, dt) => {
    if (!dt) return;
    const old = entry[field] && parseEntryDateTime(entry[field], entry.timezone);
    if (today && old?.isValid && old < today && dt < today) return;
    set(field, toZoneString(dt, entry.timezone));
  };
  setDeadline('deadline', facts.deadline);
  setDeadline('abstract_deadline', facts.abstractDeadline);

  if (!deadlinesOnly) {
    const fullName = cleanFullName(facts.fullName, entry);
    if (!entry.full_name) {
      set('full_name', fullName);
    } else if (fullName && !sameConferenceName(entry.full_name, fullName)) {
      flags.push(`${entry.id}: full_name kept as "${entry.full_name}"; source names it "${fullName}"`);
    }
    if (!entry.place) {
      set('place', facts.location);
    } else if (facts.location && !samePlace(entry.place, facts.location)) {
      flags.push(`${entry.id}: place kept as "${entry.place}"; source reports "${facts.location}"`);
    }
    updateDates(entry, facts, { set, pinned, flags });
  }
  return { changes, flags };
}

/** The start/end/date part of updateEntry; see its doc comment for the rules. */
function updateDates(entry, { startIso = null, endIso = null }, { set, pinned, flags }) {
  const start = startIso ?? entry.start;
  const end = endIso ?? entry.end;
  if (start === entry.start && end === entry.end) return;
  if (!start) return;

  const startYear = Number(start.slice(0, 4));
  if (startYear !== entry.year) {
    flags.push(
      `${entry.id}: source start date ${start} is in year ${startYear} but the edition year is ${entry.year}; start/end/date left untouched`,
    );
    return;
  }
  if (end && end < start) {
    flags.push(`${entry.id}: source range ${start} to ${end} ends before it starts; start, end and date left untouched`);
    return;
  }
  if (!endIso && entry.end && start !== entry.start) {
    flags.push(
      `${entry.id}: source moved start to ${start} but states no end; start, end and date left untouched, fix them by hand`,
    );
    return;
  }
  const date = end ? formatDateRange(start, end) : entry.date;
  const blocked = [['start', start], ['end', end], ['date', date]].filter(
    ([f, v]) => pinned.has(f) && v !== entry[f],
  );
  if (blocked.length > 0) {
    const what = blocked.map(([f, v]) => `${f} pinned (source reports ${v})`).join(', ');
    flags.push(`${entry.id}: ${what}; start, end and date left untouched`);
    return;
  }
  set('start', start);
  set('end', end);
  if (entry.start && entry.end) set('date', formatDateRange(entry.start, entry.end));
}

// Fields that are edition-specific and would be stale on a cloned draft
// (sync_pin included: a pin records a judgment about one edition's data).
const DRAFT_DROPPED_FIELDS = ['note', 'paperslink', 'deadline_status', 'sync_pin'];

/**
 * Draft a new edition by cloning the previous one and overwriting it with
 * facts. Curated fields (sub, type, timezone) carry over from the clone;
 * edition-specific fields (note, paperslink, deadline_status) are dropped, and
 * so are place, start, end and date unless the source states them. The link
 * comes from the source; a cloned one naming the previous year is flagged. The
 * full_name comes from the source when it passes the gate, else from the clone.
 * @param {object} prevEntry The venue's latest existing entry (not mutated).
 * @param {object} facts Facts from the source's own facts builder.
 * @param {number} year Edition year of the draft.
 * @returns {{entry: object, flags: string[]}} The drafted entry and the
 *   attention items (missing facts, a stale link, year mismatches).
 */
export function draftEntry(prevEntry, facts, year) {
  const entry = { ...prevEntry };
  const flags = [];
  for (const field of DRAFT_DROPPED_FIELDS) delete entry[field];
  entry.year = year;
  entry.id = nextId(prevEntry.id, year);

  const fullName = cleanFullName(facts.fullName, entry);
  if (fullName) {
    entry.full_name = fullName;
  } else {
    const why = facts.fullName ? `the source reports "${facts.fullName}"` : 'the source has none';
    flags.push(`full_name kept from ${prevEntry.id} (${why}); check its edition ordinal`);
  }
  if (facts.link) {
    entry.link = facts.link;
  } else if (entry.link && namesYear(entry.link, prevEntry.year)) {
    flags.push(`link still points at the ${prevEntry.year} edition (${entry.link}); update it by hand`);
  }
  if (facts.location) {
    entry.place = facts.location;
  } else {
    delete entry.place;
    flags.push('no place from the source yet');
  }

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
    if (facts.endIso && facts.endIso >= startIso) {
      entry.end = facts.endIso;
      entry.date = formatDateRange(entry.start, entry.end);
    } else {
      delete entry.end;
      delete entry.date;
      flags.push('no end date from the source yet; set end and date by hand');
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
