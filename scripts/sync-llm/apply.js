/**
 * Turns validated editions into edits on conferences.yaml through the shared
 * scripts/sync-shared/apply.js, adding what only a web page needs: deadlines
 * are checked against the conference start one more time, a draft gets a link
 * for its own year, and every deadline that lands gets an evidence row, so a
 * reviewer can check the value against the sentence it came from without
 * opening the venue site.
 */
import { DateTime } from 'luxon';
import { applyEdition, previousEdition } from '../sync-shared/apply.js';
import { namesYear, rollUrl } from '../sync-shared/dates.js';
import { editionToFacts } from './facts.js';

const DEADLINE_KINDS = { abstract_deadline: 'abstract', deadline: 'paper' };

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

/** The after-start check for an entry, or a draft stub, when the page named no start. */
function screenAgainstCuratedStart(facts, target) {
  const flags = dropDeadlinesAfterStart(facts, target);
  return target.start ? flags : [...flags, ...flagUncheckedAgainstStart(facts, target.id)];
}

/**
 * Links for the editions applyEditions will draft: the previous link moved to
 * the new year if that page loads, else the deadlines page if it names the
 * year. With neither, draftEntry flags the cloned link.
 * @param {{entries: Array<object>, title: string, editions: Array<object>,
 *   multiEntry?: boolean, sourceUrl: string, fetcher: object}} args
 * @returns {Promise<Object<number, string>>} Edition year to link.
 */
export async function resolveDraftLinks({ entries, title, editions, multiEntry = false, sourceUrl, fetcher }) {
  const links = {};
  if (multiEntry) return links;
  for (const { year } of editions) {
    if (entries.some((e) => e.title === title && e.year === year)) continue;
    const previous = previousEdition(entries, title, year);
    if (!previous) continue;
    const rolled = previous.link ? rollUrl(previous.link, previous.year, year) : null;
    if (rolled) {
      const page = await fetcher.fetchPage(rolled);
      if (page.ok && !page.tooShort && namesYear(page.finalUrl, year)) {
        links[year] = rolled;
        continue;
      }
    }
    if (namesYear(sourceUrl, year)) links[year] = sourceUrl;
  }
  return links;
}

/**
 * @param {{entries: Array<object>, title: string, editions: Array<object>,
 *   multiEntry?: boolean, sourceUrl: string, today?: DateTime,
 *   links?: Object<number, string>}} args entries is mutated in place; links
 *   comes from resolveDraftLinks.
 * @returns {{updates: Array<object>, drafts: Array<object>, flags: string[],
 *   evidence: Array<{id: string, field: string, quote: string, url: string}>}}
 */
export function applyEditions({ entries, title, editions, multiEntry = false, sourceUrl, today = null, links = {} }) {
  const out = { updates: [], drafts: [], flags: [], evidence: [] };
  for (const edition of editions) {
    const applied = applyEdition({
      entries,
      title,
      year: edition.year,
      today,
      multiEntry,
      factsFor: (zone) => ({ ...editionToFacts(edition, zone), link: links[edition.year] ?? null }),
      screen: edition.start_date ? undefined : screenAgainstCuratedStart,
    });
    out.updates.push(...applied.updates);
    out.drafts.push(...applied.drafts);
    out.flags.push(...applied.flags);

    const written = applied.updates.map(({ id, field }) => ({ id, field }));
    if (applied.drafted) {
      for (const field of Object.keys(DEADLINE_KINDS)) {
        if (applied.drafted[field] !== undefined) written.push({ id: applied.drafted.id, field });
      }
    }
    for (const { id, field } of written) {
      const kind = DEADLINE_KINDS[field];
      if (!kind) continue;
      const quote = edition.deadlines.find((d) => d.kind === kind)?.evidence ?? '';
      out.evidence.push({ id, field, quote, url: sourceUrl });
    }
  }
  return out;
}
