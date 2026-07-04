/**
 * Orchestrator for the OpenReview deadline sync, run as `pnpm sync` (locally
 * or by .github/workflows/sync-deadlines.yml). For each venue in venues.json
 * and each of the next three years it fetches the venue group, updates the
 * matching entries in public/data/conferences.yaml (or drafts a new edition),
 * rewrites the file only when something changed, and prints a markdown report
 * (also written to $SYNC_REPORT_PATH when set, for the PR body).
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
import { buildFacts, updateEntry, draftEntry } from './merge.js';
import { renderReport } from './report.js';
import { loadEntries, serializeEntries } from './yamlio.js';

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

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const entries = loadEntries(DATA_PATH);
  const api = createApi();
  const currentYear = DateTime.utc().year;
  const updates = [];
  const drafts = [];
  const flags = [];
  const skipped = [];

  for (const [title, venue] of Object.entries(config)) {
    for (let year = currentYear; year <= currentYear + 2; year++) {
      let content;
      try {
        content = await api.getVenueGroup(venue.prefix, year, venue.suffix);
      } catch (err) {
        skipped.push(`${title} ${year}: request failed (${err.message})`);
        continue;
      }
      if (!content) continue;

      const facts = buildFacts(sanitizeContent(content));
      if (!facts.deadline && !facts.abstractDeadline && facts.submissionId) {
        const duedate = await api.getSubmissionDuedate(facts.submissionId).catch(() => null);
        if (duedate) {
          facts.deadline = DateTime.fromMillis(duedate, { zone: 'utc' });
          flags.push(`${title} ${year}: deadline read from the Submission invitation, which some venues use for the abstract deadline; verify`);
        } else {
          flags.push(`${title} ${year}: could not parse deadlines from OpenReview; deadline fields left untouched`);
        }
      }

      const existing = entries.filter((e) => e.title === title && e.year === year);
      if (existing.length > 0) {
        for (const entry of existing) {
          const { changes, flags: updateFlags } = updateEntry(entry, facts, {
            deadlinesOnly: Boolean(venue.multiEntry),
          });
          updates.push(...changes);
          flags.push(...updateFlags);
        }
      } else if (venue.multiEntry) {
        flags.push(
          `${title} ${year}: new edition on OpenReview; this venue has multiple entries per year, add them manually. Location: ${facts.location ?? 'unknown'}, start: ${facts.startIso ?? 'unknown'}`,
        );
      } else {
        const previous = entries
          .filter((e) => e.title === title && e.year < year)
          .sort((a, b) => a.year - b.year)
          .at(-1);
        if (!previous) {
          skipped.push(`${title} ${year}: no previous edition in the YAML to clone`);
          continue;
        }
        const { entry, flags: draftFlags } = draftEntry(previous, facts, year);
        entries.splice(entries.indexOf(previous) + 1, 0, entry);
        drafts.push({ id: entry.id, title, year });
        flags.push(...draftFlags.map((f) => `${entry.id}: ${f}`));
      }
    }
  }

  const after = serializeEntries(entries);
  if (after !== raw) {
    fs.writeFileSync(DATA_PATH, after);
  }

  const report = renderReport({ updates, drafts, flags, skipped });
  console.log(report);
  if (process.env.SYNC_REPORT_PATH) {
    fs.writeFileSync(process.env.SYNC_REPORT_PATH, report);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
