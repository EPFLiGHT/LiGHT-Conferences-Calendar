/**
 * Entry point for `pnpm sync:llm`, run weekly by sync-llm.yml. For each venue
 * in venues.json it tries the cheapest route first and only escalates when the
 * cheaper one comes back without evidence-backed deadlines: read the configured
 * dates page (tier 0), let the agent follow links from the venue homepage
 * (tier 1), then let it search the web as well (tier 2). Whatever survives
 * validation is merged into conferences.yaml.
 *
 * The report it prints lists every change, the page quote behind it, and the
 * tokens each venue cost. When $SYNC_REPORT_PATH is set the report is written
 * there too, and the workflow opens its pull request with that as the body.
 *
 * Flags: --venue <title> syncs one venue; --dry-run skips all writes.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DateTime } from 'luxon';
import OpenAI from 'openai';
import { loadEntries, serializeEntries } from '../sync-shared/yamlio.js';
import { renderReport } from '../sync-shared/report.js';
import { loadApiKey, createLlm } from './llm.js';
import { createFetcher, searchWeb, normalizeUrl } from './fetch.js';
import { createBudget, createRunBudget } from './budget.js';
import { extractFromPage } from './extract.js';
import { validateEditions } from './facts.js';
import { runAgent } from './agent.js';
import { applyEditions } from './apply.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(DIR, '../..');
const DATA_PATH = path.join(REPO_ROOT, 'public/data/conferences.yaml');
const CONFIG_PATH = path.join(DIR, 'venues.json');
const OPENREVIEW_CONFIG_PATH = path.join(DIR, '../sync-openreview/venues.json');

const INPUT_PRICE_PER_M = 0.75;
const OUTPUT_PRICE_PER_M = 4.5;

/**
 * Climb the tiers for one venue, stopping at the first that yields deadlines
 * the gates in facts.js accept. Exported for tests.
 * @param {{llm, fetcher, search, entries, today, makeBudget}} ctx
 * @param {string} title Venue title as in conferences.yaml.
 * @param {{url: string, home?: string, multiEntry?: boolean}} cfg
 * @returns {Promise<{outcome: string, tier: number, editions?: Array,
 *   sourceUrl?: string, reason?: string, flags: string[]}>}
 */
export async function syncVenue(ctx, title, cfg) {
  const { llm, fetcher, search, entries, today, makeBudget } = ctx;
  const flags = [];

  const validate = (editions, sourceUrl) => {
    const pageText = fetcher.getText(sourceUrl) ?? '';
    const { editions: valid, flags: gateFlags } = validateEditions(
      { editions },
      { pageText, today },
    );
    flags.push(...gateFlags.map((f) => `${title}: ${f}`));
    const hasDeadlines = valid.some((e) => e.deadlines.length > 0);
    return hasDeadlines ? valid : null;
  };

  // Tier 0: guided extraction from the configured URL.
  const page = await fetcher.fetchPage(cfg.url);
  if (page.ok && page.tooShort) {
    flags.push(`${title}: page appears to be JS-rendered (only ${page.text.length} chars); agent fallback`);
  }
  if (page.ok && !page.tooShort) {
    const result = await extractFromPage(llm, { venueTitle: title, pageText: page.text, url: cfg.url, today });
    if (!result) {
      flags.push(`${title}: tier 0 extraction produced no usable output; agent fallback`);
    } else if (result.page_has_dates) {
      const valid = validate(result.editions, page.finalUrl);
      if (valid) return { outcome: 'submitted', tier: 0, editions: valid, sourceUrl: page.finalUrl, flags };
    } else {
      flags.push(`${title}: configured page has no deadline information; agent fallback`);
    }
  } else if (!page.ok) {
    flags.push(`${title}: configured URL failed (${page.error}); agent fallback`);
  }

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
      const valid = validate(out.editions, out.sourceUrl);
      if (valid) return { outcome: 'submitted', tier, editions: valid, sourceUrl: out.sourceUrl, flags };
      lastReason = 'submission failed validation';
    } else {
      lastReason = out.reason;
      if (out.outcome === 'aborted') flags.push(`${title}: tier ${tier} agent aborted (${out.reason})`);
    }
  }
  return { outcome: 'not_found', tier: 2, reason: lastReason, flags };
}

/**
 * Whether venues.json should start pointing at the page the deadlines were
 * found on. A configured URL too malformed to normalize counts as different:
 * it needs the update most of all. Exported for tests.
 */
export function urlNeedsUpdate(configuredUrl, sourceUrl) {
  try {
    return normalizeUrl(configuredUrl) !== sourceUrl;
  } catch {
    return true;
  }
}

/** Exported for tests. */
export function renderExtraSections({ evidence, usageByVenue, totals }) {
  const lines = [];
  if (evidence.length > 0) {
    lines.push('### Evidence', '', '| Entry | Field | Source quote | Page |', '|---|---|---|---|');
    for (const e of evidence) {
      // Quotes span table rows and headings, so they carry newlines and pipes;
      // either one would break out of the markdown row.
      const quote = e.quote.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim().slice(0, 200);
      lines.push(`| ${e.id} | ${e.field} | ${quote} | ${e.url} |`);
    }
    lines.push('');
  }
  lines.push('### Usage', '');
  for (const [venue, u] of Object.entries(usageByVenue)) {
    // "tier N" alone reads as success; empty-handed venues must not look synced.
    const where =
      u.tier == null ? 'failed'
      : u.outcome === 'submitted' ? `tier ${u.tier}`
      : `tier ${u.tier}, found nothing`;
    lines.push(`- ${venue}: ${where}, ${u.inputTokens + u.outputTokens} tokens`);
  }
  const cost =
    (totals.inputTokens * INPUT_PRICE_PER_M + totals.outputTokens * OUTPUT_PRICE_PER_M) / 1_000_000;
  lines.push(
    '',
    `Total: ${totals.inputTokens} input + ${totals.outputTokens} output tokens, est. $${cost.toFixed(3)}`,
    '',
  );
  return lines.join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const venueIdx = args.indexOf('--venue');
  if (venueIdx !== -1 && !args[venueIdx + 1]) {
    console.error('--venue requires a venue title');
    process.exit(1);
  }
  const venueFilter = venueIdx !== -1 ? args[venueIdx + 1] : null;

  const apiKey = loadApiKey(REPO_ROOT);
  if (!apiKey) {
    console.error('OPENAI_API_KEY is not set (env or .env.local); aborting.');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const openreviewConfig = JSON.parse(fs.readFileSync(OPENREVIEW_CONFIG_PATH, 'utf8'));
  const overlap = Object.keys(config).filter((t) => t in openreviewConfig);
  if (overlap.length > 0) {
    console.error(`Venues owned by both syncs (remove from one config): ${overlap.join(', ')}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const entries = loadEntries(DATA_PATH);
  const today = DateTime.utc();
  const runBudget = createRunBudget();
  let venueBudget = null;
  const onUsage = (u) => {
    runBudget.addUsage(u);
    venueBudget?.addUsage(u);
  };

  const client = new OpenAI({ apiKey, maxRetries: 3 });
  const llm = createLlm({ client, onUsage });
  const fetcher = createFetcher({});

  const updates = [];
  const drafts = [];
  const flags = [];
  const skipped = [];
  const evidence = [];
  const usageByVenue = {};
  let configChanged = false;

  for (const [title, cfg] of Object.entries(config)) {
    if (venueFilter && title !== venueFilter) continue;
    if (runBudget.exceeded()) {
      skipped.push(`${title}: run token budget exhausted`);
      continue;
    }
    // Tiers bound effort (turns, seconds); the venue and the run bound spend
    // (tokens). A tier that ends is not a venue that ended, so the venue budget
    // must not carry a clock or a turn count of its own.
    venueBudget = createBudget({ maxTurns: Infinity, maxMs: Infinity });
    const makeBudget = () => {
      const tierBudget = createBudget({ maxTokens: Infinity });
      return {
        turn: tierBudget.turn,
        limits: tierBudget.limits,
        exceeded: () => tierBudget.exceeded() ?? venueBudget.exceeded(),
      };
    };
    let out;
    try {
      out = await syncVenue(
        { llm, fetcher, search: searchWeb, entries, today, makeBudget },
        title,
        cfg,
      );
    } catch (err) {
      skipped.push(`${title}: ${err.message}`);
    } finally {
      // A venue that threw still spent its tokens; leaving it out of the
      // breakdown makes the Usage rows disagree with the run total.
      const { inputTokens, outputTokens } = venueBudget.snapshot();
      usageByVenue[title] = {
        tier: out?.tier ?? null,
        outcome: out?.outcome ?? null,
        inputTokens,
        outputTokens,
      };
    }
    if (!out) continue;
    flags.push(...out.flags);

    if (out.outcome !== 'submitted') {
      flags.push(`${title}: no deadlines found (${out.reason}); check the venue site and venues.json`);
      continue;
    }
    const applied = applyEditions({
      entries,
      title,
      editions: out.editions,
      multiEntry: Boolean(cfg.multiEntry),
      sourceUrl: out.sourceUrl,
    });
    updates.push(...applied.updates);
    drafts.push(...applied.drafts);
    flags.push(...applied.flags);
    evidence.push(...applied.evidence);

    if (urlNeedsUpdate(cfg.url, out.sourceUrl)) {
      flags.push(`${title}: deadlines found at ${out.sourceUrl}, not the configured URL; venues.json updated`);
      cfg.url = out.sourceUrl;
      configChanged = true;
    }
  }

  const after = serializeEntries(entries);
  if (!dryRun && after !== raw) fs.writeFileSync(DATA_PATH, after);
  if (!dryRun && configChanged) {
    fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
  }

  const report =
    renderReport({ updates, drafts, flags, skipped, title: 'LLM web sync report' }) +
    '\n' +
    renderExtraSections({ evidence, usageByVenue, totals: runBudget.snapshot() });
  console.log(dryRun ? '[dry run, nothing written]\n' + report : report);
  if (process.env.SYNC_REPORT_PATH) fs.writeFileSync(process.env.SYNC_REPORT_PATH, report);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
