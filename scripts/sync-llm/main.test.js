import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { syncVenue, urlNeedsUpdate, renderExtraSections } from './main.js';
import { createBudget } from './budget.js';

const TODAY = DateTime.fromISO('2026-07-08T12:00:00Z', { zone: 'utc' });
const GOOD_PAGE = 'Important dates. Paper submission deadline: May 6, 2027.';
const RESULT = {
  page_has_dates: true,
  editions: [{ year: 2027, full_name: null, location: null, start_date: null, end_date: null,
    deadlines: [{ kind: 'paper', date: '2027-05-06', time: null, timezone_text: null,
      evidence: 'Paper submission deadline: May 6, 2027' }] }],
};

function fetcherFor(pages) {
  const fetched = new Set();
  return {
    async fetchPage(url) {
      const p = pages[url];
      if (!p) return { ok: false, error: 'http 404', status: 404 };
      fetched.add(url);
      return { ok: true, finalUrl: url, text: p, links: [], tooShort: false };
    },
    hasFetched: (u) => fetched.has(u),
    getText: (u) => (fetched.has(u) ? pages[u] : null),
  };
}

function llmReturning(...outputs) {
  const queue = [...outputs];
  return {
    model: 'test',
    respond: async () => {
      const next = queue.shift();
      return typeof next === 'function' ? next() : next;
    },
  };
}

const ctx = (over = {}) => ({
  entries: [{ title: 'HealthConf', year: 2027, id: 'hc27', link: 'https://hc.example',
    timezone: 'UTC-12', sub: 'Global Health', type: 'conference' }],
  today: TODAY,
  search: async () => [],
  makeBudget: () => createBudget(),
  ...over,
});

describe('syncVenue tiering', () => {
  it('resolves at tier 0 when the configured URL works', async () => {
    const out = await syncVenue(
      ctx({
        fetcher: fetcherFor({ 'https://hc.example/dates': GOOD_PAGE }),
        llm: llmReturning({ output: [], output_text: JSON.stringify(RESULT), usage: {} }),
      }),
      'HealthConf',
      { url: 'https://hc.example/dates' },
    );
    expect(out.tier).toBe(0);
    expect(out.outcome).toBe('submitted');
    expect(out.editions[0].deadlines).toHaveLength(1);
  });

  it('escalates to tier 1 when the configured URL 404s', async () => {
    const submitCall = { output: [{ type: 'function_call', name: 'submit', call_id: 'c1',
      arguments: JSON.stringify({ not_found: false, reason: null,
        source_url: 'https://hc.example/2027/dates', editions: RESULT.editions }) }],
      output_text: '', usage: {} };
    const fetchCall = { output: [{ type: 'function_call', name: 'fetch_page', call_id: 'c0',
      arguments: JSON.stringify({ url: 'https://hc.example/2027/dates' }) }],
      output_text: '', usage: {} };
    const out = await syncVenue(
      ctx({
        fetcher: fetcherFor({ 'https://hc.example/2027/dates': GOOD_PAGE }),
        llm: llmReturning(fetchCall, submitCall),
      }),
      'HealthConf',
      { url: 'https://hc.example/dead-link', home: 'https://hc.example' },
    );
    expect(out.tier).toBe(1);
    expect(out.outcome).toBe('submitted');
    expect(out.sourceUrl).toBe('https://hc.example/2027/dates');
  });

  it('reports not_found with the last reason when every tier fails', async () => {
    const notFound = { output: [{ type: 'function_call', name: 'submit', call_id: 'c1',
      arguments: JSON.stringify({ not_found: true, reason: 'nothing online yet',
        source_url: null, editions: [] }) }], output_text: '', usage: {} };
    const out = await syncVenue(
      ctx({ fetcher: fetcherFor({}), llm: llmReturning(notFound, notFound) }),
      'HealthConf',
      { url: 'https://hc.example/dead-link' },
    );
    expect(out.outcome).toBe('not_found');
    expect(out.tier).toBe(2);
  });

  it('drops evidence-less results at tier 0 and escalates', async () => {
    const fabricated = { page_has_dates: true, editions: [{ ...RESULT.editions[0],
      deadlines: [{ ...RESULT.editions[0].deadlines[0], evidence: 'not on the page' }] }] };
    const notFound = { output: [{ type: 'function_call', name: 'submit', call_id: 'c1',
      arguments: JSON.stringify({ not_found: true, reason: 'x', source_url: null, editions: [] }) }],
      output_text: '', usage: {} };
    const out = await syncVenue(
      ctx({
        fetcher: fetcherFor({ 'https://hc.example/dates': GOOD_PAGE }),
        llm: llmReturning(
          { output: [], output_text: JSON.stringify(fabricated), usage: {} },
          notFound, notFound,
        ),
      }),
      'HealthConf',
      { url: 'https://hc.example/dates' },
    );
    expect(out.outcome).toBe('not_found');
    expect(out.flags.some((f) => f.includes('evidence not found'))).toBe(true);
  });

  it('escalates to the agent tiers when tier 0 output came back incomplete', async () => {
    const notFound = { output: [{ type: 'function_call', name: 'submit', call_id: 'c1',
      arguments: JSON.stringify({ not_found: true, reason: 'x', source_url: null, editions: [] }) }],
      output_text: '', usage: {} };
    const out = await syncVenue(
      ctx({
        fetcher: fetcherFor({ 'https://hc.example/dates': GOOD_PAGE }),
        llm: llmReturning(
          { status: 'incomplete', output: [], output_text: '', usage: {} },
          notFound, notFound,
        ),
      }),
      'HealthConf',
      { url: 'https://hc.example/dates' },
    );
    expect(out.outcome).toBe('not_found');
    expect(out.flags.some((f) => f.includes('tier 0'))).toBe(true);
  });

  it('gives tier 2 its own fresh turn budget instead of sharing tier 1\'s exhausted one', async () => {
    // Mirrors main.js's real wiring: a composite budget with a fresh
    // per-call tierBudget for turns/time, plus a shared venueBudget for the
    // venue-wide token ceiling. If makeBudget instead handed out the same
    // instance for every tier (the bug), tier 1 exhausting its turn cap
    // would make tier 2's very first exceeded() check trip immediately,
    // so the model would never be called for tier 2.
    const venueBudget = createBudget({ maxTurns: Infinity, maxMs: Infinity });
    const makeBudget = () => {
      const tierBudget = createBudget({ maxTurns: 1, maxTokens: Infinity });
      return {
        turn: tierBudget.turn,
        limits: tierBudget.limits,
        exceeded: () => tierBudget.exceeded() ?? venueBudget.exceeded(),
      };
    };

    let respondCalls = 0;
    const fetchPageCall = (id) => ({
      output: [{ type: 'function_call', name: 'fetch_page', call_id: id,
        arguments: JSON.stringify({ url: 'https://hc.example/2027/dates' }) }],
      output_text: '', usage: {},
    });
    const notFoundSubmit = { output: [{ type: 'function_call', name: 'submit', call_id: 'c3',
      arguments: JSON.stringify({ not_found: true, reason: 'still nothing', source_url: null, editions: [] }) }],
      output_text: '', usage: {} };

    const llm = {
      model: 'test',
      respond: async () => {
        respondCalls += 1;
        if (respondCalls === 1) return fetchPageCall('c1');
        if (respondCalls === 2) return fetchPageCall('c2');
        return notFoundSubmit;
      },
    };

    const out = await syncVenue(
      ctx({ fetcher: fetcherFor({}), llm, makeBudget }),
      'HealthConf',
      { url: 'https://hc.example/dead-link' },
    );

    // Tier 1 exhausts its 1-turn budget after two fetch_page calls (turns
    // reaches 2), aborting. Tier 2 must still get called: a third respond()
    // call that submits not_found. With a shared budget instance, tier 2's
    // exceeded() check would trip on the leftover turn count and abort
    // before ever calling respond(), leaving respondCalls at 2 and the
    // reason as tier 1's stale "budget turns".
    expect(respondCalls).toBe(3);
    expect(out.reason).toBe('still nothing');
  });
});

describe('urlNeedsUpdate', () => {
  it('treats a malformed configured URL as needing the update instead of throwing', () => {
    expect(urlNeedsUpdate('htps//typo', 'https://hc.example/dates')).toBe(true);
    expect(urlNeedsUpdate(undefined, 'https://hc.example/dates')).toBe(true);
  });
  it('compares normalized forms', () => {
    expect(urlNeedsUpdate('https://HC.example/dates/#section', 'https://hc.example/dates')).toBe(false);
    expect(urlNeedsUpdate('https://hc.example/old', 'https://hc.example/dates')).toBe(true);
  });
});

describe('renderExtraSections', () => {
  it('distinguishes venues that found nothing from ones that synced', () => {
    const text = renderExtraSections({
      evidence: [],
      usageByVenue: {
        Good: { tier: 0, outcome: 'submitted', inputTokens: 10, outputTokens: 2 },
        Empty: { tier: 2, outcome: 'not_found', inputTokens: 20, outputTokens: 3 },
        Broken: { tier: null, outcome: null, inputTokens: 1, outputTokens: 0 },
      },
      totals: { inputTokens: 31, outputTokens: 5 },
    });
    expect(text).toContain('- Good: tier 0, 12 tokens');
    expect(text).toContain('- Empty: tier 2, found nothing, 23 tokens');
    expect(text).toContain('- Broken: failed, 1 tokens');
  });
});
