import { describe, it, expect } from 'vitest';
import { mergeVenue, readExtraPages, syncVenue } from './main.js';
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
    expect(out.editions[0].deadlines[0].source).toBe('https://hc.example/dates');
  });

  it('escalates when the main page shows only an early-bird date', async () => {
    const page = 'Early bird registration deadline: 14 October 2026';
    const only = { page_has_dates: true, editions: [edition({ year: 2027, deadlines: [deadline({ type: 'early_registration', date: '2026-10-14', evidence: page })] })] };
    const out = await syncVenue(
      ctx({ fetcher: fakeFetcher({ 'https://hc.example/dates': page }), llm: fakeLlm(jsonReply(only), notFound(), notFound()) }),
      'HealthConf',
      { url: 'https://hc.example/dates' },
    );
    expect(out).toMatchObject({ outcome: 'not_found', tier: 2 });
  });

  it('counts a registration deadline as a find for an attendance venue', async () => {
    const page = 'Early bird registration deadline: 14 October 2026';
    const only = { page_has_dates: true, editions: [edition({ year: 2027, deadlines: [deadline({ type: 'early_registration', date: '2026-10-14', evidence: page })] })] };
    const out = await syncVenue(
      ctx({ fetcher: fakeFetcher({ 'https://hc.example/dates': page }), llm: fakeLlm(jsonReply(only)) }),
      'HealthConf',
      { url: 'https://hc.example/dates', attendance: true },
    );
    expect(out).toMatchObject({ outcome: 'submitted', tier: 0 });
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

describe('syncVenue for attendance-only venues', () => {
  const PAGE = 'Join us at FestConf Barcelona, Spain October 28-30, 2026.';
  const DATES_ONLY = {
    page_has_dates: true,
    editions: [edition({
      location: 'Barcelona, Spain', start_date: '2026-10-28', end_date: '2026-10-30',
      dates_evidence: 'Barcelona, Spain October 28-30, 2026', deadlines: [],
    })],
  };
  const cfg = { url: 'https://fest.example/', attendance: true };

  it('counts an edition the page dates, with no deadline', async () => {
    const out = await syncVenue(
      ctx({ fetcher: fakeFetcher({ 'https://fest.example/': PAGE }), llm: fakeLlm(jsonReply(DATES_ONLY)) }),
      'HealthConf',
      cfg,
    );
    expect(out.outcome).toBe('submitted');
    expect(out.tier).toBe(0);
    expect(out.editions[0].start_date).toBe('2026-10-28');
  });

  it('stops at the configured page instead of paying for the agent', async () => {
    const llm = fakeLlm(jsonReply({ page_has_dates: false, editions: [] }));
    const out = await syncVenue(ctx({ fetcher: fakeFetcher({ 'https://fest.example/': PAGE }), llm }), 'HealthConf', cfg);
    expect(llm.requests).toHaveLength(1);
    expect(out.outcome).toBe('not_found');
    expect(out.tier).toBe(0);
    expect(out.flags).toEqual([]);
  });

  it('flags a configured page that fails to load', async () => {
    const llm = fakeLlm();
    const out = await syncVenue(ctx({ fetcher: fakeFetcher(), llm }), 'HealthConf', cfg);
    expect(llm.requests).toHaveLength(0);
    expect(out.flags).toEqual(['HealthConf: configured URL failed (http 404)']);
  });
});

describe('extra pages', () => {
  const fees = 'Early bird registration deadline: 14 October 2026';
  const feesResult = { page_has_dates: true, editions: [edition({
    year: 2027, location: 'Geneva', deadlines: [deadline({ type: 'early_registration', date: '2026-10-14', evidence: fees })],
  })] };
  const cfg = { url: 'https://hc.example/dates', pages: ['https://hc.example/fees'] };

  it('reads every extra page at tier 0 and tags deadlines with their page', async () => {
    const out = await readExtraPages(ctx({ fetcher: fakeFetcher({ 'https://hc.example/fees': fees }), llm: fakeLlm(jsonReply(feesResult)) }), 'HealthConf', cfg);
    expect(out.editions[0].deadlines.map((x) => [x.type, x.source])).toEqual([['early_registration', 'https://hc.example/fees']]);
    expect(out.editions[0]).not.toHaveProperty('location');
    expect(out.flags).toEqual([]);
  });

  it('flags an extra page that fails and one skipped for budget', async () => {
    const gone = { url: 'https://hc.example/dates', pages: ['https://hc.example/gone'] };
    expect((await readExtraPages(ctx({ fetcher: fakeFetcher({}), llm: fakeLlm() }), 'HealthConf', gone)).flags)
      .toEqual(['HealthConf: extra page https://hc.example/gone configured URL failed (http 404); fix it in venues.json by hand']);
    expect((await readExtraPages(ctx({ fetcher: fakeFetcher({}), llm: fakeLlm(), budgetExceeded: () => true }), 'HealthConf', gone)).flags)
      .toEqual(['HealthConf: run token budget exhausted; extra page https://hc.example/gone not read']);
  });

  it('flags an extra page whose model call throws instead of aborting the run', async () => {
    const llm = { respond: async () => { throw new Error('upstream 503'); } };
    const out = await readExtraPages(ctx({ fetcher: fakeFetcher({ 'https://hc.example/fees': fees }), llm }), 'HealthConf', cfg);
    expect(out).toEqual({ editions: [], flags: ['HealthConf: extra page https://hc.example/fees not read (upstream 503)'] });
  });

  it('applies extra-page deadlines to a known edition when the main page found none, keeping the main flag', async () => {
    const c = ctx({ fetcher: fakeFetcher({ 'https://hc.example/fees': fees }), llm: fakeLlm(jsonReply(feesResult)) });
    const main = { outcome: 'not_found', tier: 2, reason: 'no result', flags: [] };
    const out = await mergeVenue(c, 'HealthConf', cfg, main);
    expect(c.entries[0].deadlines).toEqual([{ type: 'early_registration', due: '2026-10-14 23:59' }]);
    expect(out.flags).toContain('HealthConf: no deadlines found (no result); check the venue site and venues.json');
    expect(out.evidence).toEqual([{ id: 'hc27', field: 'early_registration', quote: fees, url: 'https://hc.example/fees' }]);
  });

  it('merges the main page result as before when no extra pages are configured', async () => {
    const c = ctx({ fetcher: fakeFetcher({}), llm: fakeLlm() });
    const main = { outcome: 'submitted', tier: 0, sourceUrl: 'https://hc.example/dates', flags: [], editions: [edition({
      year: 2027, deadlines: [deadline({ date: '2027-05-06', evidence: 'Paper submission deadline: May 6, 2027', source: 'https://hc.example/dates' })],
    })] };
    const out = await mergeVenue(c, 'HealthConf', { url: 'https://hc.example/dates' }, main);
    expect(c.entries[0].deadlines).toEqual([{ type: 'paper', due: '2027-05-06 23:59' }]);
    expect(out.updates).toHaveLength(1);
  });
});
