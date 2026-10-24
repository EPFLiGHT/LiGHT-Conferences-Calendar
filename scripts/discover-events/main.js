/**
 * Entry point for `pnpm discover:events`, run monthly by discover-events.yml.
 * Looks for upcoming high-level events in Switzerland (criteria.js) that the
 * calendar lacks and drafts them for a human to keep or delete in the PR. It
 * reads every page in sources.json, then runs one capped web search per topic
 * and reads the leads each returns. Every page gets one extraction call and
 * the checks in gates.js. Strong fits not already listed (dedupe.js) are
 * appended to the data file for their type and recorded in seen.json, so a
 * deleted draft is not proposed again; possible fits only make the report.
 *
 * sources.json format, one entry per curated page:
 *   { "<name>": { "url": "<page announcing events>", "note": "<for humans; ignored>" } }
 *
 * --dry-run writes nothing; --no-search reads the sources only.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import OpenAI from 'openai';
import { runIfMain } from '../sync-shared/run.js';
import { parseEntries, serializeEntries } from '../sync-shared/yamlio.js';
import { loadApiKey, createLlm } from '../sync-llm/llm.js';
import { createFetcher } from '../sync-llm/fetcher.js';
import { createTokenBudget } from '../sync-llm/budget.js';
import { normalizeUrl } from '../sync-llm/urls.js';
import { TOPIC_KEYS, TOPICS } from './criteria.js';
import { extractEvents } from './extract.js';
import { validateEvents } from './gates.js';
import { findLeads } from './search.js';
import { matchExisting, wasProposed, seenKey } from './dedupe.js';
import { buildDraft, DATA_FILES } from './drafts.js';
import { renderReport } from './report.js';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SOURCES_PATH = fileURLToPath(new URL('./sources.json', import.meta.url));
const SEEN_PATH = fileURLToPath(new URL('./seen.json', import.meta.url));
const RUN_MAX_TOKENS = 800_000;
const MAX_LEADS = 20;

/**
 * @param {string[]} argv Command-line arguments after the script path.
 * @returns {{dryRun: boolean, search: boolean}}
 * @throws On an unknown argument, so a typo cannot turn a dry run into a real one.
 */
export function parseArgs(argv) {
  const opts = { dryRun: false, search: true };
  for (const arg of argv) {
    if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--no-search') opts.search = false;
    else if (arg !== '--') throw new Error(`unknown argument ${arg} (expected --dry-run or --no-search)`);
  }
  return opts;
}

/**
 * The whole run except file IO. Exported for tests.
 * @param {{llm, fetcher, sources: object, entries: Array<object>, seen: object,
 *   today: DateTime, budget: {exceeded: () => string|null}, search?: boolean}} ctx
 *   entries are those of every data file.
 * @returns {Promise<{proposals: Array<{event: object, entry: object, file: string}>,
 *   possible: Array<object>, attention: string[], dropped: string[],
 *   stats: {pages: number, searches: number}}>} proposals are the strong fits, drafted.
 */
export async function discover({ llm, fetcher, sources, entries, seen, today, budget, search = true }) {
  const accepted = [];
  const attention = [];
  const dropped = [];
  const stats = { pages: 0, searches: 0 };
  const read = new Set();

  // Resolves true when the page cost an extraction call.
  const readPage = async (url, origin, curated) => {
    let key;
    try {
      key = normalizeUrl(url);
    } catch {
      dropped.push(`${origin}: malformed URL ${url}`);
      return false;
    }
    if (read.has(key)) return false;
    read.add(key);
    if (budget.exceeded()) {
      attention.push('run token budget exhausted; the remaining pages were not read');
      return false;
    }
    const page = await fetcher.fetchPage(key);
    const failure = !page.ok ? page.error : page.tooShort ? 'page appears to be JS-rendered' : null;
    if (failure) {
      // A curated source that stops working needs fixing; a dead search lead does not.
      (curated ? attention : dropped).push(`${origin}: ${url} could not be read (${failure})`);
      return false;
    }
    if (page.finalUrl !== key && read.has(page.finalUrl)) return false;
    read.add(page.finalUrl);
    stats.pages += 1;
    const result = await extractEvents(llm, { url: page.finalUrl, text: page.text, links: page.links, today })
      .catch((err) => ({ error: err.message }));
    if (!result?.events) {
      const why = result?.error ? ` (${result.error})` : '';
      attention.push(`${origin}: no usable extraction from ${page.finalUrl}${why}`);
      return true;
    }
    const checked = validateEvents(result.events, {
      pageText: page.text, pageUrl: page.finalUrl, links: page.links, today,
    });
    dropped.push(...checked.dropped);
    for (const event of checked.events) {
      // A curated page lists many events, so its own URL identifies none of them.
      event.ownLink = !(curated && event.link === page.finalUrl);
      const label = `${event.title} ${event.year}`;
      const { same, prior } = matchExisting(event, entries);
      const twin = matchExisting(event, accepted).same;
      if (same) {
        dropped.push(`${label}: already on the calendar as ${same.id}`);
      } else if (wasProposed(seen, event)) {
        dropped.push(`${label}: proposed in an earlier run`);
      } else if (twin && (twin.fit === 'strong' || event.fit !== 'strong')) {
        dropped.push(`${label}: found twice this run`);
      } else {
        // A strong sighting replaces a possible one.
        if (twin) accepted.splice(accepted.indexOf(twin), 1);
        accepted.push({ ...event, origin, prior });
      }
    }
    return true;
  };

  for (const [name, cfg] of Object.entries(sources)) await readPage(cfg.url, name, true);

  if (search) {
    let leadsRead = 0;
    for (const topic of TOPIC_KEYS) {
      if (budget.exceeded() || leadsRead >= MAX_LEADS) break;
      // Recomputed per topic, so events found under one topic are not searched for again.
      const known = [
        ...entries.filter((e) => /switzerland/i.test(e.place ?? '') && (e.end ?? '') >= today.toISODate()),
        ...accepted,
        ...Object.values(seen).filter((s) => s.year >= today.year),
      ].map((e) => `${e.title} ${e.year}`);
      const out = await findLeads(llm, { topic, today, known })
        .catch((err) => ({ leads: null, searches: 0, error: err.message }));
      stats.searches += out.searches;
      if (!out.leads) {
        const why = out.error ? ` (${out.error})` : '';
        attention.push(`web search on "${TOPICS[topic]}" returned no usable answer${why}`);
        continue;
      }
      for (const lead of out.leads) {
        if (leadsRead >= MAX_LEADS) break;
        if (await readPage(lead.url, `web search, ${TOPICS[topic].toLowerCase()}`, false)) leadsRead += 1;
      }
    }
  }

  const takenIds = new Set(entries.map((e) => e.id));
  const proposals = [];
  const possible = [];
  for (const event of accepted) {
    // Possible fits are listed in the report only, and so can come back next month.
    if (event.fit !== 'strong') {
      possible.push(event);
      continue;
    }
    const draft = buildDraft(event, { prior: event.prior, takenIds });
    if (draft.error) {
      attention.push(`${event.title} ${event.year}: not drafted, ${draft.error}`);
      continue;
    }
    takenIds.add(draft.entry.id);
    for (const note of draft.notes) attention.push(`${draft.entry.id}: ${note}`);
    proposals.push({ event, entry: draft.entry, file: draft.file });
  }
  return { proposals, possible, attention, dropped, stats };
}

async function main() {
  const { dryRun, search } = parseArgs(process.argv.slice(2));
  const apiKey = loadApiKey(REPO_ROOT);
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set (env or .env.local); aborting.');
    process.exit(1);
  }

  const budget = createTokenBudget(RUN_MAX_TOKENS);
  const llm = createLlm({
    client: new OpenAI({ apiKey, maxRetries: 3 }),
    onUsage: (u) => budget.addUsage(u),
  });
  const files = Object.values(DATA_FILES).map((name) => {
    const filePath = path.join(REPO_ROOT, 'public/data', name);
    const raw = fs.readFileSync(filePath, 'utf8');
    return { name, filePath, raw, entries: parseEntries(raw) ?? [] };
  });
  const seen = JSON.parse(fs.readFileSync(SEEN_PATH, 'utf8'));
  const today = DateTime.utc();

  const run = await discover({
    llm,
    fetcher: createFetcher(),
    sources: JSON.parse(fs.readFileSync(SOURCES_PATH, 'utf8')),
    entries: files.flatMap((f) => f.entries),
    seen,
    today,
    budget,
    search,
  });

  if (!dryRun && run.proposals.length > 0) {
    // Appended as text, so the hand-written entries above keep their formatting.
    for (const f of files) {
      const added = run.proposals.filter((p) => p.file === f.name).map((p) => p.entry);
      if (added.length > 0) fs.writeFileSync(f.filePath, `${f.raw.trimEnd()}\n\n${serializeEntries(added)}`);
    }
    for (const { event, entry } of run.proposals) {
      seen[seenKey(entry)] = {
        title: entry.title, full_name: entry.full_name ?? null, year: entry.year,
        link: event.ownLink ? entry.link : null, proposed: today.toISODate(),
      };
    }
    const sorted = Object.fromEntries(Object.entries(seen).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(SEEN_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  }

  const report = renderReport({
    ...run,
    totals: budget.snapshot(),
    seenPath: path.relative(REPO_ROOT, SEEN_PATH),
  });
  console.log(dryRun ? `[dry run, nothing written]\n${report}` : report);
  if (process.env.SYNC_REPORT_PATH) fs.writeFileSync(process.env.SYNC_REPORT_PATH, report);
}

runIfMain(import.meta.url, main);
