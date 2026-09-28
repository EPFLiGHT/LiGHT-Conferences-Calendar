/**
 * Orchestrator for the OpenReview deadline sync, run as `pnpm sync:openreview`
 * (locally or by .github/workflows/sync-openreview.yml). For each venue in venues.json
 * and each of the next three years it fetches the venue group, updates the
 * matching entries in public/data/conferences.yaml (or drafts a new edition),
 * rewrites the file only when something changed, and prints a markdown report
 * (also written to $SYNC_REPORT_PATH when set, for the PR body).
 *
 * Only what OpenReview states is written. Editions that have ended are left
 * alone, and the submission form's closing time is reported, not written.
 *
 * venues.json format, one entry per synced venue:
 *   { "<title as it appears in conferences.yaml>": {
 *       "prefix": "<OpenReview group prefix, e.g. NeurIPS.cc>",
 *       "suffix": "<group segment after the year, defaults to Conference>",
 *       "multiEntry": true  // venue has several entries per year (one per
 *                           // location): only deadlines are updated and new
 *                           // editions are reported instead of drafted
 *   } }
 * Venues absent from venues.json are never touched.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import { createApi } from './api.js';
import { buildFacts } from './facts.js';
import { updateEntry, draftEntry } from '../sync-shared/merge.js';
import { editionEnded } from '../sync-shared/dates.js';
import { renderReport } from '../sync-shared/report.js';
import { loadEntries, serializeEntries } from '../sync-shared/yamlio.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(DIR, '../../public/data/conferences.yaml');
const CONFIG_PATH = path.join(DIR, 'venues.json');

// The parsers in parse.js assume these fields arrive as strings, but
// OpenReview occasionally returns a numeric epoch instead (e.g. LoG's
// start_date). Drop non-string values so one odd venue cannot crash the
// run or feed a timezone-ambiguous epoch into a curated field.
const STRING_FIELDS = ['date', 'location', 'start_date', 'title', 'submission_id'];
function sanitizeContent(content) {
  const clean = { ...content };
  for (const key of STRING_FIELDS) {
    if (clean[key] && typeof clean[key].value !== 'string') {
      delete clean[key];
    }
  }
  return clean;
}

/**
 * Sync one venue's edition for one year into entries (mutated in place).
 * Exported for tests.
 * @param {{api: object, entries: Array<object>, title: string, venue: object,
 *   year: number, today: DateTime}} args venue is the venues.json value.
 * @returns {Promise<{updates: Array<object>, drafts: Array<object>,
 *   flags: string[], skipped: string[]}>}
 */
export async function syncEdition({ api, entries, title, venue, year, today }) {
  const out = { updates: [], drafts: [], flags: [], skipped: [] };
  let content;
  try {
    content = await api.getVenueGroup(venue.prefix, year, venue.suffix);
  } catch (err) {
    out.skipped.push(`${title} ${year}: request failed (${err.message})`);
    return out;
  }
  if (!content) return out;

  const facts = buildFacts(sanitizeContent(content));
  const existing = entries.filter((e) => e.title === title && e.year === year);
  const open = existing.filter((e) => !editionEnded(e, today));

  const needsDeadline = existing.length === 0 || open.some((e) => !e.deadline);
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

  if (existing.length > 0) {
    for (const entry of open) {
      const { changes, flags } = updateEntry(entry, facts, {
        deadlinesOnly: Boolean(venue.multiEntry),
        today,
      });
      out.updates.push(...changes);
      out.flags.push(...flags);
    }
  } else if (venue.multiEntry) {
    out.flags.push(
      `${title} ${year}: new edition on OpenReview; this venue has multiple entries per year, add them manually. Location: ${facts.location ?? 'unknown'}, start: ${facts.startIso ?? 'unknown'}`,
    );
  } else {
    const previous = entries
      .filter((e) => e.title === title && e.year < year)
      .sort((a, b) => a.year - b.year)
      .at(-1);
    if (!previous) {
      out.skipped.push(`${title} ${year}: no previous edition in the YAML to clone`);
      return out;
    }
    const { entry, flags } = draftEntry(previous, facts, year);
    entries.splice(entries.indexOf(previous) + 1, 0, entry);
    out.drafts.push({ id: entry.id, title, year });
    out.flags.push(...flags.map((f) => `${entry.id}: ${f}`));
  }
  return out;
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const entries = loadEntries(DATA_PATH);
  const api = createApi();
  const today = DateTime.utc();
  const run = { updates: [], drafts: [], flags: [], skipped: [] };

  for (const [title, venue] of Object.entries(config)) {
    for (let year = today.year; year <= today.year + 2; year++) {
      const out = await syncEdition({ api, entries, title, venue, year, today });
      for (const key of Object.keys(run)) run[key].push(...out[key]);
    }
  }

  const after = serializeEntries(entries);
  if (after !== raw) {
    fs.writeFileSync(DATA_PATH, after);
  }

  const report = renderReport({ ...run, title: 'OpenReview sync report' });
  console.log(report);
  if (process.env.SYNC_REPORT_PATH) {
    fs.writeFileSync(process.env.SYNC_REPORT_PATH, report);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
