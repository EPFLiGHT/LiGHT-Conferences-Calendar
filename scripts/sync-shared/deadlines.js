/**
 * How a source's deadlines land in an entry's curated `deadlines` list.
 * A source reports `[{type, due}]` (due a Luxon instant, at most one per
 * type); it never writes a label or type `other`, and never removes or
 * retypes an item. Each reported deadline, in order:
 *   1. a type the source reports twice is left untouched;
 *   2. the entry's one item of that type is updated (several: flagged);
 *   3. an abstract-family type the entry lacks matches the entry's one family
 *      item when the source also reports exactly one (other counts: flagged);
 *   4. an item of the same group (not `other`) due the same day in the entry
 *      zone blocks the add, flagged;
 *   5. otherwise it is added.
 */
import { ABSTRACT_FAMILY, DEADLINE_TYPES } from '../../src/constants/deadlineTypes.data.js';
import { parseEntryDateTime } from '../../src/utils/conferenceSchema.js';
import { toZoneString } from './dates.js';

const groupOf = (type) => DEADLINE_TYPES[type]?.group;
// Due strings of one entry share its zone, so they sort as text.
const byDue = (a, b) => a.due.localeCompare(b.due);

/** `poster`, or `presenter_registration "Poster presenter registration"` for a labeled item. */
export function deadlineName(item) {
  return item.label ? `${item.type} "${item.label}"` : item.type;
}

/** What a change row's Field column shows. */
export function changeFieldName(change) {
  return change.field === 'deadlines' ? deadlineName(change) : change.field;
}

/**
 * Assign `entry.deadlines`; a new key goes after `link`, else `full_name`, else last.
 * @param {object} entry Mutated.
 * @param {Array<object>} items
 */
export function setDeadlinesKey(entry, items) {
  if ('deadlines' in entry) {
    entry.deadlines = items;
    return;
  }
  const anchor = ['link', 'full_name'].find((k) => k in entry);
  const pairs = Object.entries(entry);
  for (const [k] of pairs) delete entry[k];
  for (const [k, v] of pairs) {
    entry[k] = v;
    if (k === anchor) entry.deadlines = items;
  }
  if (!anchor) entry.deadlines = items;
}

/**
 * Reported deadlines as a drafted entry's items, in due order.
 * @param {Array<{type: string, due: import('luxon').DateTime}>} reported
 * @param {string} zone The entry's timezone.
 * @returns {Array<{type: string, due: string}>}
 */
export function draftDeadlines(reported, zone) {
  return reported.map((d) => ({ type: d.type, due: toZoneString(d.due, zone) })).sort(byDue);
}

/**
 * Merge reported deadlines into `entry.deadlines` (mutated); see the header for the rules.
 * @param {object} entry
 * @param {Array<{type: string, due: import('luxon').DateTime}>} reported
 * @param {{today?: import('luxon').DateTime|null}} [opts] With today, an item whose old and
 *   new dates have both passed is left alone.
 * @returns {{changes: Array<object>, flags: string[]}}
 */
export function mergeDeadlines(entry, reported, { today = null } = {}) {
  const { id, timezone: zone } = entry;
  const changes = [];
  const flags = [];
  const items = [...(entry.deadlines ?? [])];
  // The family match pairs the source's deadline with what the entry already
  // had; the source's own additions this run are not candidates.
  const familyBefore = items.filter((item) => ABSTRACT_FAMILY.includes(item.type));
  let wrote = false;

  const reportedCount = (type) => reported.filter((d) => d.type === type).length;
  const reportedFamily = reported.filter((d) => ABSTRACT_FAMILY.includes(d.type)).length;
  const twice = new Set();

  const update = (item, d, next) => {
    if (item.due === next) return;
    const old = parseEntryDateTime(item.due, zone);
    if (today && old.isValid && old < today && d.due < today) return;
    if (item.pin) {
      flags.push(`${id}: ${deadlineName(item)} pinned; source reports ${next}`);
      return;
    }
    changes.push({
      id, field: 'deadlines', type: item.type, ...(item.label && { label: item.label }),
      reported: d.type, old: item.due, new: next,
    });
    item.due = next;
    wrote = true;
    // Only on a write, so a stable disagreement is not flagged every run.
    if (item.type !== d.type) flags.push(`${id}: source calls the ${deadlineName(item)} deadline ${d.type}; date updated, type kept`);
  };

  for (const d of reported) {
    const next = toZoneString(d.due, zone);
    if (reportedCount(d.type) > 1) {
      if (!twice.has(d.type)) flags.push(`${id}: source reports ${d.type} twice; left untouched`);
      twice.add(d.type);
      continue;
    }
    const same = items.filter((item) => item.type === d.type);
    if (same.length > 1) {
      flags.push(`${id}: ${same.length} ${d.type} deadlines in the entry; source reports ${next}; left untouched`);
      continue;
    }
    if (same.length === 1) {
      update(same[0], d, next);
      continue;
    }
    if (ABSTRACT_FAMILY.includes(d.type)) {
      if (familyBefore.length === 1 && reportedFamily === 1) {
        update(familyBefore[0], d, next);
        continue;
      }
      if (familyBefore.length > 0) {
        flags.push(`${id}: source reports a ${d.type} deadline (${next}) but the entry has ${familyBefore.map(deadlineName).join(', ')}; left untouched`);
        continue;
      }
    }
    const day = next.slice(0, 10);
    const clash = items.find((item) => item.type !== 'other' && groupOf(item.type) === groupOf(d.type) && item.due.slice(0, 10) === day);
    if (clash) {
      flags.push(`${id}: source reports a ${d.type} deadline on ${day}, the day of the entry's ${deadlineName(clash)} deadline; not added`);
      continue;
    }
    items.push({ type: d.type, due: next });
    changes.push({ id, field: 'deadlines', type: d.type, reported: d.type, old: null, new: next });
    wrote = true;
  }

  if (wrote) setDeadlinesKey(entry, items.sort(byDue));
  return { changes, flags };
}
