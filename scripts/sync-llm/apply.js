/**
 * Turns validated editions into edits on conferences.yaml. An edition whose
 * title and year already exist updates that entry; an unknown year is drafted
 * from the venue's most recent earlier edition. Venues that keep several
 * entries for one year are never drafted into, only flagged, since there is no
 * way to guess which of them the new dates belong to. Every deadline that
 * lands gets an evidence row, so a reviewer can check the value against the
 * sentence it came from without opening the venue site.
 */
import { DateTime } from 'luxon';
import { updateEntry, draftEntry } from '../sync-shared/merge.js';
import { editionToFacts, bigMoveFlags } from './facts.js';

const DEADLINE_FIELDS = new Set(['deadline', 'abstract_deadline']);

/**
 * A submission deadline cannot fall after its own conference has begun. Venues
 * announce the next call on the site of the edition that just ended, so a model
 * asked for the "current" deadlines will happily hand back a date months past
 * the conference. Nulls out those facts, trusting the entry's curated start.
 * Only called when the page named no start of its own: against a page start,
 * validateEditions already checked, and the curated one may be stale (a
 * postponed conference would lose its valid new deadline to it).
 * @returns {string[]} One flag per dropped fact.
 */
function dropDeadlinesAfterStart(facts, entry) {
  if (!entry.start) return [];
  // In the entry's own zone: a deadline late on the start day is still valid.
  const start = DateTime.fromISO(entry.start, { zone: entry.timezone ?? 'utc' });
  if (!start.isValid) return [];
  const flags = [];
  for (const [key, field] of [['deadline', 'deadline'], ['abstractDeadline', 'abstract_deadline']]) {
    const dt = facts[key];
    if (dt && dt > start.endOf('day')) {
      const shown = dt.setZone(entry.timezone ?? 'utc').toISODate();
      flags.push(
        `${entry.id}: ${field} ${shown} is after the conference start ${entry.start}; it belongs to a later edition, dropped`,
      );
      facts[key] = null;
    }
  }
  return flags;
}

/**
 * Exactly one after-start check runs per edition: validateEditions against the
 * start the page reported, or dropDeadlinesAfterStart against the curated YAML
 * start when the page named none. When the page names no start and the entry
 * has none either (a fresh draft, or an entry whose dates are still TBA),
 * neither can run and the deadline reaches the file unchecked, bounded only by
 * the year and plausibility windows. Say so rather than let it look verified.
 * @returns {string[]} One flag when deadlines were applied without that check.
 */
function flagUncheckedAgainstStart(facts, id) {
  if (!facts.deadline && !facts.abstractDeadline) return [];
  return [
    `${id}: no conference start date on the page or in the YAML, so the deadlines could not be checked against it; verify they belong to this edition and not the next`,
  ];
}

/**
 * @param {{entries: Array<object>, title: string, editions: Array<object>,
 *   multiEntry?: boolean, sourceUrl: string}} args entries is mutated in place.
 * @returns {{updates: Array<object>, drafts: Array<object>, flags: string[],
 *   evidence: Array<{id: string, field: string, quote: string, url: string}>}}
 */
export function applyEditions({ entries, title, editions, multiEntry = false, sourceUrl }) {
  const updates = [];
  const drafts = [];
  const flags = [];
  const evidence = [];

  const quoteFor = (edition, field) => {
    const kind = field === 'abstract_deadline' ? 'abstract' : 'paper';
    return edition.deadlines.find((d) => d.kind === kind)?.evidence ?? '';
  };
  const record = (edition, changes) => {
    updates.push(...changes);
    flags.push(...bigMoveFlags(changes));
    for (const c of changes) {
      if (DEADLINE_FIELDS.has(c.field)) {
        evidence.push({ id: c.id, field: c.field, quote: quoteFor(edition, c.field), url: sourceUrl });
      }
    }
  };

  for (const edition of editions) {
    const existing = entries.filter((e) => e.title === title && e.year === edition.year);
    if (existing.length > 0) {
      for (const entry of existing) {
        const facts = editionToFacts(edition, entry.timezone);
        if (!edition.start_date) {
          flags.push(...dropDeadlinesAfterStart(facts, entry));
          if (!entry.start) flags.push(...flagUncheckedAgainstStart(facts, entry.id));
        }
        const { changes, flags: updateFlags } = updateEntry(entry, facts, {
          deadlinesOnly: multiEntry,
        });
        record(edition, changes);
        flags.push(...updateFlags);
      }
      continue;
    }
    if (multiEntry) {
      flags.push(
        `${title} ${edition.year}: new edition found on the venue site; this venue has multiple entries per year, add them manually`,
      );
      continue;
    }
    const previous = entries
      .filter((e) => e.title === title && e.year < edition.year)
      .sort((a, b) => a.year - b.year)
      .at(-1);
    if (!previous) {
      flags.push(`${title} ${edition.year}: no previous edition in the YAML to clone; skipped`);
      continue;
    }
    const facts = editionToFacts(edition, previous.timezone);
    const { entry, flags: draftFlags } = draftEntry(previous, facts, edition.year);
    entries.splice(entries.indexOf(previous) + 1, 0, entry);
    drafts.push({ id: entry.id, title, year: edition.year });
    flags.push(...draftFlags.map((f) => `${entry.id}: ${f}`));
    // A draft has no curated start, so edition.start_date is the only anchor.
    if (!edition.start_date) flags.push(...flagUncheckedAgainstStart(facts, entry.id));
    for (const kind of ['abstract', 'paper']) {
      const d = edition.deadlines.find((x) => x.kind === kind);
      if (d) {
        const field = kind === 'abstract' ? 'abstract_deadline' : 'deadline';
        if (entry[field] !== undefined) {
          evidence.push({
            id: entry.id,
            field,
            quote: d.evidence,
            url: sourceUrl,
          });
        }
      }
    }
  }
  return { updates, drafts, flags, evidence };
}
