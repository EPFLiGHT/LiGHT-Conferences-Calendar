/**
 * Entry point for `pnpm sync:openreview`, run monthly by
 * .github/workflows/sync-openreview.yml. For each venue in venues.json and each
 * of the next three years it fetches the venue group and applies it to
 * public/data/conferences.yaml (see scripts/sync-shared/run.js for the flags,
 * the write-back and the report).
 *
 * Only what OpenReview states is written. Editions that have ended are left
 * alone, and the submission form's closing time is reported, not written.
 *
 * venues.json format, one entry per synced venue:
 *   { "<title as it appears in conferences.yaml>": {
 *       "prefix": "<OpenReview group prefix, e.g. NeurIPS.cc>",
 *       "multiEntry": true  // venue has several entries per year (one per
 *                           // location): only deadlines are updated and new
 *                           // editions are reported instead of drafted
 *   } }
 * Venues absent from venues.json are never touched.
 */
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { createApi } from './api.js';
import { buildFacts } from './facts.js';
import { applyEdition } from '../sync-shared/apply.js';
import { editionEnded } from '../sync-shared/dates.js';
import { emptyOutcome, addOutcome } from '../sync-shared/report.js';
import { runSync, runIfMain } from '../sync-shared/run.js';

const CONFIG_PATH = fileURLToPath(new URL('./venues.json', import.meta.url));

/**
 * Sync one venue's edition for one year into entries (mutated in place).
 * Exported for tests.
 * @param {{api: object, entries: Array<object>, title: string, venue: object,
 *   year: number, today: DateTime}} args venue is the venues.json value.
 * @returns {Promise<{updates: Array<object>, drafts: Array<object>,
 *   flags: string[], skipped: string[]}>}
 */
export async function syncEdition({ api, entries, title, venue, year, today }) {
  const out = emptyOutcome();
  let content;
  try {
    content = await api.getVenueGroup(venue.prefix, year);
  } catch (err) {
    out.skipped.push(`${title} ${year}: request failed (${err.message})`);
    return out;
  }
  if (!content) return out;

  const facts = buildFacts(content);
  const existing = entries.filter((e) => e.title === title && e.year === year);
  const needsDeadline = existing.length === 0 || existing.some((e) => !editionEnded(e, today) && !e.deadline);
  if (!facts.deadline && !facts.abstractDeadline && needsDeadline) {
    // This due date is ICLR's abstract deadline but LoG's paper deadline, so it fills neither field.
    const duedate = facts.submissionId
      ? await api.getSubmissionDuedate(facts.submissionId).catch(() => null)
      : null;
    out.flags.push(
      duedate
        ? `${title} ${year}: OpenReview states no deadlines; its submission form closes ${DateTime.fromMillis(duedate, { zone: 'utc' }).toFormat('yyyy-MM-dd HH:mm')} UTC, which is the abstract deadline at some venues and the paper deadline at others; deadline fields left untouched`
        : `${title} ${year}: OpenReview states no deadlines yet; deadline fields left untouched`,
    );
  }

  return addOutcome(out, applyEdition({
    entries, title, year, today, multiEntry: Boolean(venue.multiEntry), factsFor: () => facts,
  }));
}

/**
 * Sync this year's edition of one venue and the next two. Exported for tests.
 * @param {{api: object, entries: Array<object>, title: string, venue: object,
 *   today: DateTime}} args
 * @returns {Promise<object>} The editions' outcomes, concatenated.
 */
export async function syncVenue({ api, entries, title, venue, today }) {
  const out = emptyOutcome();
  for (let year = today.year; year <= today.year + 2; year++) {
    addOutcome(out, await syncEdition({ api, entries, title, venue, year, today }));
  }
  return out;
}

async function main() {
  const api = createApi();
  await runSync({
    title: 'OpenReview sync report',
    configPath: CONFIG_PATH,
    perVenue: (title, venue, { entries, today }) => syncVenue({ api, entries, title, venue, today }),
  });
}

runIfMain(import.meta.url, main);
