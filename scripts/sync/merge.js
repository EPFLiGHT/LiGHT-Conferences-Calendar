/**
 * Merge rules: decides what OpenReview data may be written into a conference
 * entry. Only "factual" fields are ever touched (deadline, abstract_deadline,
 * full_name, place, start, end, date); curated fields (sub, type, note, link,
 * paperslink, id, timezone, deadline_status, hindex, pwclink) are protected by
 * construction because they are never passed to the setter.
 */
import {
  parseVenueDateString,
  parseStartDate,
  toZoneString,
  formatDateRange,
  nextId,
  inferEndDate,
} from './parse.js';

const PLACEHOLDER_RE = /^(tbd|tba)$/i;

/**
 * Distill an OpenReview venue group's `content` into the facts the sync uses.
 * @param {object} content Venue group content (fields wrapped as {value: ...}).
 * @returns {{
 *   fullName: string|null,
 *   location: string|null,
 *   startIso: string|null,
 *   submissionId: string|null,
 *   abstractDeadline: DateTime|null,
 *   deadline: DateTime|null,
 * }} Missing, empty or placeholder ("TBD"/"TBA") values come back as null.
 */
export function buildFacts(content) {
  const value = (key) => content?.[key]?.value;
  const dates = parseVenueDateString(value('date'));
  const location = (value('location') || '').trim();
  return {
    fullName: value('title') || null,
    location: location && !PLACEHOLDER_RE.test(location) ? location : null,
    startIso: parseStartDate(value('start_date')),
    submissionId: value('submission_id') || null,
    abstractDeadline: dates.abstractDeadline || null,
    deadline: dates.deadline || null,
  };
}

/**
 * Apply facts to an existing entry, mutating it in place. Deadlines are
 * rendered in the entry's own timezone. When the start moves, the end is
 * shifted by the same delta and flagged; when the OpenReview start year does
 * not match the edition year (upstream typo), start/end/date are left
 * untouched and flagged instead.
 * @param {object} entry A conferences.yaml entry (mutated).
 * @param {object} facts Facts from buildFacts.
 * @param {{deadlinesOnly?: boolean}} [opts] deadlinesOnly restricts writes to
 *   deadline fields, used for venues split into one entry per location.
 * @returns {{changes: Array<{id: string, field: string, old: string|null, new: string}>, flags: string[]}}
 *   The field-level changes made and any items needing human attention.
 */
export function updateEntry(entry, facts, { deadlinesOnly = false } = {}) {
  const changes = [];
  const flags = [];
  const set = (field, next) => {
    if (next == null) return;
    const old = entry[field];
    if (old === next) return;
    entry[field] = next;
    changes.push({ id: entry.id, field, old: old ?? null, new: next });
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
          `${entry.id}: OpenReview start_date ${facts.startIso} is in year ${startYear} but the edition year is ${entry.year}; start/end/date left untouched`,
        );
      } else {
        const oldStart = entry.start;
        set('start', facts.startIso);
        if (oldStart && entry.end) {
          set('end', inferEndDate(oldStart, entry.end, facts.startIso));
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
  return { changes, flags };
}

// Fields that are edition-specific and would be stale on a cloned draft.
const DRAFT_DROPPED_FIELDS = ['note', 'paperslink', 'deadline_status'];

/**
 * Draft a new edition by cloning the previous one and overwriting it with
 * facts. Curated fields (sub, type, timezone, link) carry over from the clone;
 * edition-specific fields (note, paperslink, deadline_status) are dropped; the
 * end date is inferred from the previous edition's duration and flagged.
 * @param {object} prevEntry The venue's latest existing entry (not mutated).
 * @param {object} facts Facts from buildFacts.
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
  else flags.push(`place kept from ${prevEntry.id}; none on OpenReview yet`);

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
    flags.push('no submission deadline on OpenReview yet');
  }

  let startIso = facts.startIso;
  if (startIso) {
    const startYear = Number(startIso.slice(0, 4));
    if (startYear !== year) {
      flags.push(
        `OpenReview start_date ${startIso} is in year ${startYear} but the edition year is ${year}; start, end and date left unset`,
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
      flags.push('no start date on OpenReview yet; set start, end and date manually');
    }
  }
  return { entry, flags };
}
