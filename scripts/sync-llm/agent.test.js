import { describe, it, expect } from 'vitest';
import { runAgent } from './agent.js';
import { createBudget } from './budget.js';
import { TODAY, edition, deadline, fakeFetcher, fakeLlm, call, toolReply } from './test-helpers.js';

const EDITIONS = [edition({ deadlines: [deadline({ date: '2026-05-06', evidence: 'e' })] })];

/** An llm whose i-th reply calls the tools in the i-th script entry. */
const scriptedLlm = (script) => fakeLlm(...script.map((calls) => toolReply(...calls)));

const base = (over = {}) => ({
  fetcher: fakeFetcher({ 'https://conf.example/dates': 'Deadline: May 6, 2026' }),
  budget: createBudget(),
  venueTitle: 'Conf',
  startUrl: 'https://conf.example',
  today: TODAY,
  search: async () => [],
  ...over,
});

/** Capture the system prompt runAgent sends on its first call. */
async function systemPromptOf(overrides = {}) {
  const llm = fakeLlm();
  await runAgent({ llm, ...base(overrides) });
  return llm.requests[0].input.find((m) => m.role === 'system').content;
}

describe('runAgent system prompt', () => {
  it('states today and the edition years in scope', async () => {
    const prompt = await systemPromptOf();
    expect(prompt).toContain('2026-07-08');
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
    const blocked = await runAgent({ llm: llmBlocked, ...base({ search }) });
    expect(blocked.outcome).toBe('not_found');

    const llmCapped = scriptedLlm([
      [call('search_web', { query: 'a' })],
      [call('search_web', { query: 'b' })],
      [call('search_web', { query: 'c' })],
      [call('submit', { not_found: true, reason: 'exhausted', source_url: null, editions: [] })],
    ]);
    const capped = await runAgent({ llm: llmCapped, ...base({ search, searchEnabled: true }) });
    expect(capped.outcome).toBe('not_found');
  });
});
