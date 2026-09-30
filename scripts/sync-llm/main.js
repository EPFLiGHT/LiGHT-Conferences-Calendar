/**
 * Entry point for `pnpm sync:llm`, run monthly by sync-llm.yml. For each venue
 * in venues.json it tries the cheapest route first and only escalates when the
 * cheaper one comes back without evidence-backed deadlines: read the configured
 * dates page, first as it would be for the next edition's year (tier 0), let
 * the agent follow links from the venue homepage (tier 1), then let it search
 * the web as well (tier 2). Whatever survives validation is merged into
 * conferences.yaml (see scripts/sync-shared/run.js for the flags, the
 * write-back and the report). The report adds the page quote behind every
 * change and the tokens each venue cost.
 *
 * venues.json format, one entry per synced venue:
 *   { "<title as it appears in conferences.yaml>": {
 *       "url": "<page listing the deadlines, read at tier 0>",
 *       "home": "<where the agent starts; defaults to the entry's link>",
 *       "multiEntry": true,  // optional, as in scripts/sync-openreview/venues.json
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
import { runAgent } from './agent.js';
import { applyEditions, resolveDraftLinks } from './apply.js';
import { followSource } from './venue-config.js';
import { renderExtraSections } from './report.js';

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const CONFIG_PATH = fileURLToPath(new URL('./venues.json', import.meta.url));
const RUN_MAX_TOKENS = 500_000;
const VENUE_MAX_TOKENS = 80_000;

/**
 * Climb the tiers for one venue, stopping at the first that yields deadlines
 * the gates in gates.js accept. Exported for tests.
 * @param {{llm, fetcher, search, entries, today, makeBudget}} ctx
 * @param {string} title Venue title as in conferences.yaml.
 * @param {{url: string, home?: string}} cfg
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

  // Tier 0 on one page: the surviving editions, else why there are none
  // (reason null when the gates rejected them and have flagged why).
  const tryPage = async (url) => {
    const page = await fetcher.fetchPage(url);
    if (!page.ok) return { reason: `configured URL failed (${page.error})` };
    if (page.tooShort) return { reason: `page appears to be JS-rendered (only ${page.text.length} chars)` };
    const result = await extractFromPage(llm, { venueTitle: title, pageText: page.text, url, today });
    if (!result) return { reason: 'tier 0 extraction produced no usable output' };
    if (!result.page_has_dates) return { reason: 'configured page has no deadline information' };
    const editions = validate(result.editions, page.finalUrl);
    return editions ? { editions, sourceUrl: page.finalUrl } : { reason: null };
  };
  const found = (tier, { editions, sourceUrl }) => ({ outcome: 'submitted', tier, editions, sourceUrl, flags });

  // Try next year's version of the URL first: old edition pages stay up with stale dates.
  const year = urlYear(cfg.url);
  const nextUrl = year && year < today.year + 2 ? rollUrl(cfg.url, year, year + 1) : null;
  if (nextUrl) {
    const next = await tryPage(nextUrl);
    if (next.editions) return found(0, next);
  }
  const configured = await tryPage(cfg.url);
  if (configured.editions) return found(0, configured);
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
      const editions = validate(out.editions, out.sourceUrl);
      if (editions) return found(tier, { editions, sourceUrl: out.sourceUrl });
      lastReason = 'submission failed validation';
    } else {
      lastReason = out.reason;
      if (out.outcome === 'aborted') flags.push(`${title}: tier ${tier} agent aborted (${out.reason})`);
    }
  }
  return { outcome: 'not_found', tier: 2, reason: lastReason, flags };
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
    let out;
    try {
      out = await syncVenue(
        { llm, fetcher, search: searchWeb, entries, today, makeBudget: () => createTierBudget(venueBudget) },
        title,
        cfg,
      );
    } catch (err) {
      return { skipped: [`${title}: ${err.message}`] };
    } finally {
      // A venue that threw still spent its tokens; leaving it out of the
      // breakdown makes the Usage rows disagree with the run total.
      const { inputTokens, outputTokens } = venueBudget.snapshot();
      usageByVenue[title] = { tier: out?.tier ?? null, outcome: out?.outcome ?? null, inputTokens, outputTokens };
    }

    if (out.outcome !== 'submitted') {
      return {
        flags: [...out.flags, `${title}: no deadlines found (${out.reason}); check the venue site and venues.json`],
      };
    }
    const multiEntry = Boolean(cfg.multiEntry);
    const links = await resolveDraftLinks({
      entries, title, editions: out.editions, multiEntry, sourceUrl: out.sourceUrl, fetcher,
    });
    const applied = applyEditions({
      entries, title, editions: out.editions, multiEntry, sourceUrl: out.sourceUrl, today, links,
    });
    evidence.push(...applied.evidence);
    const moved = await followSource(title, cfg, out.sourceUrl, fetcher);
    return { ...applied, flags: [...out.flags, ...applied.flags, ...moved] };
  };

  await runSync({
    title: 'LLM web sync report',
    configPath: CONFIG_PATH,
    perVenue,
    extraReport: () => renderExtraSections({ evidence, usageByVenue, totals: runBudget.snapshot() }),
  });
}

runIfMain(import.meta.url, main);
