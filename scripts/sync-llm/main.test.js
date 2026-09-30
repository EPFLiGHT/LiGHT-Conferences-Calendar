import { describe, it, expect } from 'vitest';
import { syncVenue } from './main.js';
import { createBudget, createTokenBudget, createTierBudget } from './budget.js';
import {
  TODAY, edition, deadline, fakeFetcher, fakeLlm, call, toolReply, jsonReply,
} from './test-helpers.js';

const GOOD_PAGE = 'Important dates. Paper submission deadline: May 6, 2027.';
const RESULT = {
  page_has_dates: true,
  editions: [edition({
    year: 2027,
    deadlines: [deadline({ date: '2027-05-06', evidence: 'Paper submission deadline: May 6, 2027' })],
  })],
};
const notFound = (reason = 'x') =>
  toolReply(call('submit', { not_found: true, reason, source_url: null, editions: [] }));

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
      ctx({ fetcher: fakeFetcher({ 'https://hc.example/dates': GOOD_PAGE }), llm: fakeLlm(jsonReply(RESULT)) }),
      'HealthConf',
      { url: 'https://hc.example/dates' },
    );
    expect(out.tier).toBe(0);
    expect(out.outcome).toBe('submitted');
    expect(out.editions[0].deadlines).toHaveLength(1);
  });

  it('reads the configured page moved to the next year first, where a site that moved on keeps its new dates', async () => {
    const out = await syncVenue(
      ctx({
        fetcher: fakeFetcher({
          'https://hc.example/2026/dates': 'Important dates. Paper submission deadline: May 6, 2026.',
          'https://hc.example/2027/dates': GOOD_PAGE,
        }),
        llm: fakeLlm(jsonReply(RESULT)),
      }),
      'HealthConf',
      { url: 'https://hc.example/2026/dates' },
    );
    expect(out.tier).toBe(0);
    expect(out.sourceUrl).toBe('https://hc.example/2027/dates');
  });

  it('falls back to the configured page when the next year has none', async () => {
    const out = await syncVenue(
      ctx({ fetcher: fakeFetcher({ 'https://hc.example/2027/dates-old': GOOD_PAGE }), llm: fakeLlm(jsonReply(RESULT)) }),
      'HealthConf',
      { url: 'https://hc.example/2027/dates-old' },
    );
    expect(out.tier).toBe(0);
    expect(out.sourceUrl).toBe('https://hc.example/2027/dates-old');
    expect(out.flags).toEqual([]);
  });

  it('escalates to tier 1 when the configured URL 404s', async () => {
    const llm = fakeLlm(
      toolReply(call('fetch_page', { url: 'https://hc.example/2027/dates' })),
      toolReply(call('submit', {
        not_found: false, reason: null, source_url: 'https://hc.example/2027/dates', editions: RESULT.editions,
      })),
    );
    const out = await syncVenue(
      ctx({ fetcher: fakeFetcher({ 'https://hc.example/2027/dates': GOOD_PAGE }), llm }),
      'HealthConf',
      { url: 'https://hc.example/dead-link', home: 'https://hc.example' },
    );
    expect(out.tier).toBe(1);
    expect(out.outcome).toBe('submitted');
    expect(out.sourceUrl).toBe('https://hc.example/2027/dates');
    expect(out.flags).toEqual(['HealthConf: configured URL failed (http 404); agent fallback']);
  });

  it('reports not_found with the last reason when every tier fails', async () => {
    const out = await syncVenue(
      ctx({ fetcher: fakeFetcher(), llm: fakeLlm(notFound('nothing online yet'), notFound('nothing online yet')) }),
      'HealthConf',
      { url: 'https://hc.example/dead-link' },
    );
    expect(out.outcome).toBe('not_found');
    expect(out.tier).toBe(2);
    expect(out.reason).toBe('nothing online yet');
  });

  it('drops evidence-less results at tier 0 and escalates', async () => {
    const fabricated = { page_has_dates: true, editions: [{ ...RESULT.editions[0],
      deadlines: [{ ...RESULT.editions[0].deadlines[0], evidence: 'not on the page' }] }] };
    const out = await syncVenue(
      ctx({
        fetcher: fakeFetcher({ 'https://hc.example/dates': GOOD_PAGE }),
        llm: fakeLlm(jsonReply(fabricated), notFound(), notFound()),
      }),
      'HealthConf',
      { url: 'https://hc.example/dates' },
    );
    expect(out.outcome).toBe('not_found');
    expect(out.flags.some((f) => f.includes('evidence not found'))).toBe(true);
    expect(out.flags.some((f) => f.includes('agent fallback'))).toBe(false);
  });

  it('escalates to the agent tiers when tier 0 output came back incomplete', async () => {
    const out = await syncVenue(
      ctx({
        fetcher: fakeFetcher({ 'https://hc.example/dates': GOOD_PAGE }),
        llm: fakeLlm({ status: 'incomplete' }, notFound(), notFound()),
      }),
      'HealthConf',
      { url: 'https://hc.example/dates' },
    );
    expect(out.outcome).toBe('not_found');
    expect(out.flags.some((f) => f.includes('tier 0'))).toBe(true);
  });

  it('gives tier 2 its own fresh turn budget instead of sharing tier 1\'s exhausted one', async () => {
    // With one budget shared across tiers, tier 1 spending its single turn
    // would trip tier 2's first check, and the model would never be asked again.
    const venueBudget = createTokenBudget(80_000);
    const fetchDates = () => toolReply(call('fetch_page', { url: 'https://hc.example/2027/dates' }));
    const llm = fakeLlm(fetchDates(), fetchDates(), notFound('still nothing'));

    const out = await syncVenue(
      ctx({ fetcher: fakeFetcher(), llm, makeBudget: () => createTierBudget(venueBudget, { maxTurns: 1 }) }),
      'HealthConf',
      { url: 'https://hc.example/dead-link' },
    );

    expect(llm.requests).toHaveLength(3);
    expect(out.reason).toBe('still nothing');
  });
});
