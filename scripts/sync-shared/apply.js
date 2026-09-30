// One reported edition updates its entries that have not ended, or is drafted from the latest earlier one.
// multiEntry venues (one entry per location) only get deadline updates; new editions are flagged, not drafted.
import { parseEntryDateTime } from '../../src/utils/conferenceSchema.js';
import { updateEntry, draftEntry } from './merge.js';
import { editionEnded, nextId } from './dates.js';

const BIG_MOVE_DAYS = 60;

/**
 * The venue's latest edition before `year`, which a new edition is cloned from.
 * @param {Array<object>} entries conferences.yaml entries.
 * @param {string} title Venue title.
 * @param {number} year Edition year.
 * @returns {object|undefined}
 */
export function previousEdition(entries, title, year) {
  return entries
    .filter((e) => e.title === title && e.year < year)
    .sort((a, b) => a.year - b.year)
    .at(-1);
}

/**
 * Flag applied deadline changes that moved by more than BIG_MOVE_DAYS.
 * @param {Array<{id: string, field: string, old: string|null, new: string}>} changes
 *   The change list updateEntry returns; values are "yyyy-MM-dd HH:mm[:ss]".
 * @returns {string[]}
 */
export function bigMoveFlags(changes) {
  const flags = [];
  for (const c of changes) {
    if (c.field !== 'deadline' && c.field !== 'abstract_deadline') continue;
    if (!c.old) continue;
    const oldDt = parseEntryDateTime(c.old);
    const newDt = parseEntryDateTime(c.new);
    if (!oldDt.isValid || !newDt.isValid) continue;
    const days = Math.abs(newDt.diff(oldDt, 'days').days);
    if (days > BIG_MOVE_DAYS) {
      flags.push(`${c.id}: large deadline move on ${c.field} (${Math.round(days)} days); verify against the venue site`);
    }
  }
  return flags;
}

/**
 * Apply one reported edition to entries (mutated in place).
 * @param {object} args
 * @param {Array<object>} args.entries conferences.yaml entries.
 * @param {string} args.title Venue title.
 * @param {number} args.year Edition year.
 * @param {(timezone: string) => object} args.factsFor The merge facts, read in
 *   the timezone of the entry they land in (a source may state times without a zone).
 * @param {DateTime} [args.today] Editions that ended before it are left alone.
 * @param {boolean} [args.multiEntry] The venue keeps several entries per year.
 * @param {(facts: object, target: object) => string[]} [args.screen] Runs on the
 *   facts before they are written and may null some out; returns flags. target
 *   is the existing entry, or `{id, timezone}` of a draft, which has no curated dates.
 * @returns {{updates: Array<object>, drafts: Array<object>, flags: string[], drafted: object|null}}
 *   drafted is the new entry when one was drafted.
 */
export function applyEdition({ entries, title, year, factsFor, today = null, multiEntry = false, screen = () => [] }) {
  const out = { updates: [], drafts: [], flags: [], drafted: null };
  const existing = entries.filter((e) => e.title === title && e.year === year);

  if (existing.length > 0) {
    for (const entry of existing) {
      if (today && editionEnded(entry, today)) continue;
      const facts = factsFor(entry.timezone);
      out.flags.push(...screen(facts, entry));
      const { changes, flags } = updateEntry(entry, facts, { deadlinesOnly: multiEntry, today });
      out.updates.push(...changes);
      out.flags.push(...bigMoveFlags(changes), ...flags);
    }
    return out;
  }

  const previous = previousEdition(entries, title, year);
  const timezone = previous?.timezone ?? 'utc';
  const facts = factsFor(timezone);
  if (multiEntry) {
    const stated = [['location', facts.location], ['start', facts.startIso]]
      .filter(([, value]) => value)
      .map(([key, value]) => `${key}: ${value}`);
    out.flags.push(
      `${title} ${year}: new edition found; this venue has multiple entries per year, add them manually` +
        (stated.length > 0 ? ` (${stated.join('; ')})` : ''),
    );
    return out;
  }
  if (!previous) {
    out.flags.push(`${title} ${year}: no previous edition in the YAML to clone; add it manually`);
    return out;
  }

  const id = nextId(previous.id, year);
  out.flags.push(...screen(facts, { id, timezone }));
  const { entry, flags } = draftEntry(previous, facts, year);
  entries.splice(entries.indexOf(previous) + 1, 0, entry);
  out.drafts.push({ id: entry.id, title, year });
  out.flags.push(...flags.map((f) => `${entry.id}: ${f}`));
  out.drafted = entry;
  return out;
}
