import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { runAgent } from './agent.js';
import { createBudget } from './budget.js';
import { createLlm } from './llm.js';

const TODAY = DateTime.fromISO('2026-07-09T00:00:00Z', { zone: 'utc' });

const EDITIONS = [{ year: 2026, full_name: null, location: null, start_date: null, end_date: null,
  deadlines: [{ kind: 'paper', date: '2026-05-06', time: null, timezone_text: null, evidence: 'e' }] }];

/** Build an llm whose i-th call returns the i-th scripted output array. */
function scriptedLlm(script) {
  const queue = [...script];
  const client = { responses: { create: async () => ({
    output: queue.shift() ?? [],
    output_text: '',
    usage: { input_tokens: 1, output_tokens: 1 },
  }) } };
  return createLlm({ client });
}

const call = (name, args, id = Math.random().toString(36).slice(2)) =>
  ({ type: 'function_call', name, arguments: JSON.stringify(args), call_id: id });

function fakeFetcher(pages = {}) {
  const fetched = new Set();
  const textByUrl = {};
  return {
    async fetchPage(url) {
      const page = pages[url];
      if (!page) return { ok: false, error: 'http 404', status: 404 };
      const { text, finalUrl } = typeof page === 'string' ? { text: page, finalUrl: url } : page;
      fetched.add(url);
      fetched.add(finalUrl);
      textByUrl[url] = text;
      textByUrl[finalUrl] = text;
      return { ok: true, finalUrl, text, links: [], tooShort: false };
    },
    hasFetched: (url) => fetched.has(url),
    getText: (url) => (fetched.has(url) ? textByUrl[url] : null),
  };
}

const base = (over = {}) => ({
  fetcher: fakeFetcher({ 'https://conf.example/dates': 'Deadline: May 6, 2026' }),
  budget: createBudget(),
  venueTitle: 'Conf',
  startUrl: 'https://conf.example',
  today: TODAY,
  ...over,
});

/** Capture the system prompt runAgent sends on its first call. */
async function systemPromptOf(overrides = {}) {
  let prompt;
  const client = { responses: { create: async (req) => {
    prompt ??= req.input.find((m) => m.role === 'system').content;
    return { output: [], output_text: '', usage: {} };
  } } };
  await runAgent({ llm: createLlm({ client }), ...base(overrides) });
  return prompt;
}

describe('runAgent system prompt', () => {
  it('states today and the edition years in scope', async () => {
    const prompt = await systemPromptOf();
    expect(prompt).toContain('2026-07-09');
    expect(prompt).toContain('2028');
  });

  it('binds the evidence to the single page cited in source_url', async () => {
    const prompt = await systemPromptOf();
    expect(prompt).toMatch(/evidence[\s\S]*source_url|source_url[\s\S]*evidence/i);
    expect(prompt).toMatch(/same page|single page|one page/i);
  });

  it('states the real tool-call budget rather than a hardcoded number', async () => {
    expect(await systemPromptOf()).toContain('6 tool calls');
    expect(await systemPromptOf({ budget: createBudget({ maxTurns: 3 }) })).toContain('3 tool calls');
  });

  it('mentions the search allowance only when search is enabled', async () => {
    expect(await systemPromptOf({ searchEnabled: true })).toMatch(/2 web searches/i);
    expect(await systemPromptOf()).not.toMatch(/web searches/i);
  });
});

describe('runAgent', () => {
  it('fetches then submits (happy path)', async () => {
    const llm = scriptedLlm([
      [call('fetch_page', { url: 'https://conf.example/dates' })],
      [call('submit', { not_found: false, reason: null, source_url: 'https://conf.example/dates', editions: EDITIONS })],
    ]);
    const out = await runAgent({ llm, ...base() });
    expect(out).toEqual({ outcome: 'submitted', editions: EDITIONS, sourceUrl: 'https://conf.example/dates' });
  });

  it('accepts submit citing the redirect final URL for the page it fetched', async () => {
    const llm = scriptedLlm([
      [call('fetch_page', { url: 'https://conf.example/dates' })],
      [call('submit', { not_found: false, reason: null, source_url: 'https://www.conf.example/dates', editions: EDITIONS })],
    ]);
    const fetcher = fakeFetcher({
      'https://conf.example/dates': { text: 'Deadline: May 6, 2026', finalUrl: 'https://www.conf.example/dates' },
    });
    const out = await runAgent({ llm, ...base({ fetcher }) });
    expect(out).toEqual({ outcome: 'submitted', editions: EDITIONS, sourceUrl: 'https://www.conf.example/dates' });
  });

  it('rejects submit citing a page only a previous run on the same fetcher fetched', async () => {
    // The fetcher is shared across venues and tiers; the provenance gate
    // must count this run's fetches, not the cache's.
    const fetcher = fakeFetcher({ 'https://other-venue.example/dates': 'Deadline: May 6, 2026' });
    const firstRun = scriptedLlm([
      [call('fetch_page', { url: 'https://other-venue.example/dates' })],
      [call('submit', { not_found: true, reason: 'wrong venue', source_url: null, editions: [] })],
    ]);
    await runAgent({ llm: firstRun, ...base({ fetcher }) });

    const secondRun = scriptedLlm([
      [call('submit', { not_found: false, reason: null, source_url: 'https://other-venue.example/dates', editions: EDITIONS })],
      [call('submit', { not_found: true, reason: 'cannot verify', source_url: null, editions: [] })],
    ]);
    const out = await runAgent({ llm: secondRun, ...base({ fetcher }) });
    expect(out.outcome).toBe('not_found');
  });

  it('rejects submit citing a page it never fetched', async () => {
    const llm = scriptedLlm([
      [call('submit', { not_found: false, reason: null, source_url: 'https://conf.example/dates', editions: EDITIONS })],
      [call('submit', { not_found: true, reason: 'cannot verify', source_url: null, editions: [] })],
    ]);
    const out = await runAgent({ llm, ...base() });
    expect(out.outcome).toBe('not_found');
  });

  it('aborts when the turn budget is exhausted', async () => {
    const llm = scriptedLlm(Array.from({ length: 10 }, (_, i) =>
      [call('fetch_page', { url: `https://conf.example/p${i}` })]));
    const out = await runAgent({ llm, ...base({ budget: createBudget({ maxTurns: 3 }) }) });
    expect(out).toEqual({ outcome: 'aborted', reason: 'budget turns' });
  });

  it('nudges once on no tool call, then aborts', async () => {
    const llm = scriptedLlm([
      [{ type: 'message', content: [] }],
      [{ type: 'message', content: [] }],
    ]);
    const out = await runAgent({ llm, ...base() });
    expect(out).toEqual({ outcome: 'aborted', reason: 'no progress' });
  });

  it('aborts on a third fetch of the same URL', async () => {
    const url = 'https://conf.example/dates';
    const llm = scriptedLlm([
      [call('fetch_page', { url })],
      [call('fetch_page', { url })],
      [call('fetch_page', { url })],
    ]);
    const out = await runAgent({ llm, ...base() });
    expect(out).toEqual({ outcome: 'aborted', reason: 'stuck refetching the same URL' });
  });

  it('returns tool errors to the model for disallowed URLs and burns the turn', async () => {
    const llm = scriptedLlm([
      [call('fetch_page', { url: 'http://127.0.0.1/x' })],
      [call('submit', { not_found: true, reason: 'nothing reachable', source_url: null, editions: [] })],
    ]);
    const budget = createBudget();
    const out = await runAgent({ llm, ...base({ budget }) });
    expect(out.outcome).toBe('not_found');
    expect(budget.snapshot().turns).toBe(2);
  });

  it('blocks search when not enabled and caps it at 2 when enabled', async () => {
    const search = async () => [{ title: 'r', url: 'https://found.example' }];
    const llmBlocked = scriptedLlm([
      [call('search_web', { query: 'conf 2026' })],
      [call('submit', { not_found: true, reason: 'no search', source_url: null, editions: [] })],
    ]);
    const blocked = await runAgent({ llm: llmBlocked, search, ...base() });
    expect(blocked.outcome).toBe('not_found');

    const llmCapped = scriptedLlm([
      [call('search_web', { query: 'a' })],
      [call('search_web', { query: 'b' })],
      [call('search_web', { query: 'c' })],
      [call('submit', { not_found: true, reason: 'exhausted', source_url: null, editions: [] })],
    ]);
    const capped = await runAgent({ llm: llmCapped, search, ...base({ searchEnabled: true }) });
    expect(capped.outcome).toBe('not_found');
  });
});
