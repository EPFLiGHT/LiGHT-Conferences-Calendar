/**
 * Entry point for `pnpm sync:llm`, run monthly by sync-llm.yml. For each venue
 * in venues.json it tries the cheapest route first and only escalates when the
 * cheaper one comes back without an evidence-backed submission deadline (any
 * dated edition for an attendance venue): read the configured
 * dates page, first as it would be for the next edition's year (tier 0), let
 * the agent follow links from the venue homepage (tier 1), then let it search
 * the web as well (tier 2). Whatever survives validation is merged into
 * conferences.yaml or summits.yaml, whichever holds the venue (see
 * scripts/sync-shared/run.js for the flags, the write-back and the report).
 * The report adds the page quote behind every change and the tokens each venue
 * cost.
 *
 * venues.json format, one entry per synced venue:
 *   { "<title as it appears in the data file>": {
 *       "url": "<page listing the deadlines, read at tier 0>",
 *       "home": "<where the agent starts; defaults to the entry's link>",
 *       "multiEntry": true,  // optional, as in scripts/sync-openreview/venues.json
 *       "pages": ["<registration, fees or scholarship page>"],  // optional: read at tier 0 every run, never rewritten
 *       "attendance": true,  // optional: no call for submissions, so dated editions count; tier 0 only
 *       "note": "<free-form comment for humans; the sync ignores it>"
 *   } }
 * When the deadlines turn up elsewhere, the sync rewrites url (and moves a
 * year-specific home along). A venue belongs to one sync only.
 */
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { runSync, runIfMain } from '../sync-shared/run.js';
import { rollUrl, urlYear } from '../sync-shared/dates.js';
import { loadApiKey, createLlm } from './llm.js';
import { createFetcher } from './fetcher.js';
import { searchWeb } from './search.js';
import { createTokenBudget, createTierBudget } from './budget.js';
import { extractFromPage } from './extract.js';
import { validateEditions } from './gates.js';
import { DEADLINE_TYPES } from '../../src/constants/deadlineTypes.data.js';
import { runAgent } from './agent.js';
import { applyEditions, resolveDraftLinks } from './apply.js';
import { combineEditions } from './combine.js';
import { followSource } from './venue-config.js';
import { renderExtraSections } from './report.js';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CONFIG_PATH = fileURLToPath(new URL('./venues.json', import.meta.url));
const RUN_MAX_TOKENS = 500_000;
const VENUE_MAX_TOKENS = 80_000;

/** Gate one page's editions, tagging every surviving deadline with that page; gate flags go to `flags`. */
function gate({ fetcher, today }, title, editions, sourceUrl, flags) {
  const pageText = fetcher.getText(sourceUrl) ?? '';
  const { editions: valid, flags: gateFlags } = validateEditions({ editions }, { pageText, today });
  flags.push(...gateFlags.map((f) => `${title}: ${f}`));
  return valid.map((e) => ({ ...e, deadlines: e.deadlines.map((d) => ({ ...d, source: sourceUrl })) }));
}

/**
 * Tier 0 on one page: first as it would be for the next edition's year (old
 * edition pages stay up with stale dates; the move is not saved), then as given.
 * @param {(editions: Array<object>) => boolean} usable Whether gated editions count as a find.
 * @param {(edition: object) => object} [prepare] Applied to each extracted edition before the gates.
 * @returns {Promise<{editions?: Array<object>, sourceUrl?: string, reason?: string|null, flags: string[]}>}
 *   reason says why the page as given yielded nothing; null when the gates
 *   rejected it and have flagged why.
 */
async function readPage(ctx, title, cfg, url, usable, prepare = (e) => e) {
  const { llm, fetcher, today } = ctx;
  const flags = [];
  const tryPage = async (pageUrl) => {
    const page = await fetcher.fetchPage(pageUrl);
    if (!page.ok) return { reason: `configured URL failed (${page.error})` };
    if (page.tooShort) return { reason: `page appears to be JS-rendered (only ${page.text.length} chars)` };
    const result = await extractFromPage(llm, {
      venueTitle: title, pageText: page.text, url: pageUrl, today, attendance: Boolean(cfg.attendance),
    });
    if (!result) return { reason: 'tier 0 extraction produced no usable output' };
    // Between announcements an attendance event has nothing to flag.
    if (!result.page_has_dates) return { reason: cfg.attendance ? null : 'configured page has no deadline information' };
    const editions = gate(ctx, title, result.editions.map(prepare), page.finalUrl, flags);
    return usable(editions) ? { editions, sourceUrl: page.finalUrl } : { reason: null };
  };

  const year = urlYear(url);
  const nextUrl = year && year < today.year + 2 ? rollUrl(url, year, year + 1) : null;
  if (nextUrl) {
    const next = await tryPage(nextUrl);
    if (next.editions) return { ...next, flags };
  }
  return { ...(await tryPage(url)), flags };
}

/**
 * Climb the tiers for one venue, stopping at the first that yields a submission
 * deadline the gates in gates.js accept (any dated edition for an attendance
 * venue). Exported for tests.
 * @param {{llm, fetcher, search, entries, today, makeBudget}} ctx
 * @param {string} title Venue title as in conferences.yaml.
 * @param {{url: string, home?: string, attendance?: boolean}} cfg
 * @returns {Promise<{outcome: string, tier: number, editions?: Array,
 *   sourceUrl?: string, reason?: string, flags: string[]}>}
 */
export async function syncVenue(ctx, title, cfg) {
  const { llm, fetcher, search, entries, today, makeBudget } = ctx;
  const usable = (editions) => editions.some((e) => (cfg.attendance
    ? Boolean(e.start_date) || e.deadlines.length > 0
    : e.deadlines.some((d) => DEADLINE_TYPES[d.type]?.group === 'submission')));

  const configured = await readPage(ctx, title, cfg, cfg.url, usable);
  const { flags } = configured;
  const found = (tier, { editions, sourceUrl }) => ({ outcome: 'submitted', tier, editions, sourceUrl, flags });
  if (configured.editions) return found(0, configured);
  // Attendance events post their next dates on their own page, so they skip the agent.
  if (cfg.attendance) {
    if (configured.reason) flags.push(`${title}: ${configured.reason}`);
    return { outcome: 'not_found', tier: 0, reason: configured.reason ?? 'no upcoming dates on the page', flags };
  }
  if (configured.reason) flags.push(`${title}: ${configured.reason}; agent fallback`);

  // Tiers 1 and 2: bounded agent, search unlocked only at tier 2.
  const home = cfg.home ?? entries.find((e) => e.title === title)?.link ?? cfg.url;
  let lastReason = 'no result';
  for (const tier of [1, 2]) {
    const out = await runAgent({
      llm,
      fetcher,
      search,
      budget: makeBudget(),
      venueTitle: title,
      startUrl: home,
      today,
      searchEnabled: tier === 2,
    });
    if (out.outcome === 'submitted') {
      const editions = gate(ctx, title, out.editions, out.sourceUrl, flags);
      if (usable(editions)) return found(tier, { editions, sourceUrl: out.sourceUrl });
      lastReason = 'submission failed validation';
    } else {
      lastReason = out.reason;
      if (out.outcome === 'aborted') flags.push(`${title}: tier ${tier} agent aborted (${out.reason})`);
    }
  }
  return { outcome: 'not_found', tier: 2, reason: lastReason, flags };
}

// An extra page's name and place are discarded, so the gates need not check them.
const deadlinesOnly = (edition) => ({ ...edition, full_name: null, location: null });

/**
 * Tier 0 on each of a venue's extra pages (registration, fees, scholarships).
 * Any deadline counts, only years and deadlines are kept, and the agent never runs.
 * @param {object} ctx syncVenue's, plus `budgetExceeded?: () => boolean`.
 * @returns {Promise<{editions: Array<{year: number, deadlines: Array<object>}>, flags: string[]}>}
 */
export async function readExtraPages(ctx, title, cfg) {
  const editions = [];
  const flags = [];
  const anyDeadline = (eds) => eds.some((e) => e.deadlines.length > 0);
  for (const url of cfg.pages ?? []) {
    if (ctx.budgetExceeded?.()) {
      flags.push(`${title}: run token budget exhausted; extra page ${url} not read`);
      continue;
    }
    let page;
    try {
      page = await readPage(ctx, title, cfg, url, anyDeadline, deadlinesOnly);
    } catch (err) {
      // One failed model call must not abort the whole run.
      flags.push(`${title}: extra page ${url} not read (${err.message})`);
      continue;
    }
    flags.push(...page.flags);
    if (page.editions) {
      for (const { year, deadlines } of page.editions) if (deadlines.length > 0) editions.push({ year, deadlines });
    } else if (page.reason) {
      flags.push(`${title}: extra page ${url} ${page.reason}; fix it in venues.json by hand`);
    }
  }
  return { editions, flags };
}

/**
 * Merge one venue's finds into the entries: the main page's editions (from a
 * successful syncVenue only) combined with its extra pages'. The main page's
 * "no deadlines found" flag stays even when extra pages delivered, and only a
 * main-page find may move venues.json.
 * @param {object} ctx syncVenue's, plus `budgetExceeded?: () => boolean`.
 * @param {object} out What syncVenue returned for this venue.
 * @returns {Promise<{updates: Array, drafts: Array, flags: string[], evidence: Array}>}
 */
export async function mergeVenue(ctx, title, cfg, out) {
  const { entries, today, fetcher } = ctx;
  const submitted = out.outcome === 'submitted';
  const flags = [...out.flags];
  if (!submitted && !cfg.attendance) {
    flags.push(`${title}: no deadlines found (${out.reason}); check the venue site and venues.json`);
  }
  const extra = cfg.pages ? await readExtraPages(ctx, title, cfg) : { editions: [], flags: [] };
  const own = entries.filter((e) => e.title === title).sort((a, b) => a.year - b.year);
  const combined = combineEditions({
    title, main: submitted ? out.editions : [], extras: extra.editions,
    knownYears: new Set(own.map((e) => e.year)), zone: own.at(-1)?.timezone ?? 'utc',
  });
  flags.push(...extra.flags, ...combined.flags);
  if (combined.editions.length === 0) return { updates: [], drafts: [], flags, evidence: [] };

  const multiEntry = Boolean(cfg.multiEntry);
  const sourceUrl = out.sourceUrl ?? cfg.url;
  const links = await resolveDraftLinks({ entries, title, editions: combined.editions, multiEntry, sourceUrl, fetcher });
  const applied = applyEditions({ entries, title, editions: combined.editions, multiEntry, sourceUrl, today, links });
  const moved = submitted ? await followSource(title, cfg, out.sourceUrl, fetcher) : [];
  return { ...applied, flags: [...flags, ...applied.flags, ...moved] };
}

async function main() {
  const apiKey = loadApiKey(REPO_ROOT);
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set (env or .env.local); aborting.');
    process.exit(1);
  }

  // The run and each venue cap tokens; each agent tier caps its own turns and time.
  const runBudget = createTokenBudget(RUN_MAX_TOKENS);
  let venueBudget = null;
  const llm = createLlm({
    client: new OpenAI({ apiKey, maxRetries: 3 }),
    onUsage: (u) => {
      runBudget.addUsage(u);
      venueBudget?.addUsage(u);
    },
  });
  const fetcher = createFetcher();
  const evidence = [];
  const usageByVenue = {};

  const perVenue = async (title, cfg, { entries, today }) => {
    if (runBudget.exceeded()) return { skipped: [`${title}: run token budget exhausted`] };
    venueBudget = createTokenBudget(VENUE_MAX_TOKENS);
    const ctx = {
      llm, fetcher, search: searchWeb, entries, today,
      makeBudget: () => createTierBudget(venueBudget),
      budgetExceeded: () => runBudget.exceeded(),
    };
    // A venue that threw still spent its tokens; leaving it out of the
    // breakdown makes the Usage rows disagree with the run total.
    const recordUsage = (out) => {
      const { inputTokens, outputTokens } = venueBudget.snapshot();
      usageByVenue[title] = { tier: out?.tier ?? null, outcome: out?.outcome ?? null, inputTokens, outputTokens };
    };
    let out;
    try {
      out = await syncVenue(ctx, title, cfg);
    } catch (err) {
      recordUsage(null);
      return { skipped: [`${title}: ${err.message}`] };
    }
    const { evidence: rows, ...merged } = await mergeVenue(ctx, title, cfg, out);
    recordUsage(out);
    evidence.push(...rows);
    return merged;
  };

  await runSync({
    title: 'LLM web sync report',
    configPath: CONFIG_PATH,
    perVenue,
    extraReport: () => renderExtraSections({ evidence, usageByVenue, totals: runBudget.snapshot() }),
  });
}

runIfMain(import.meta.url, main);
