import { describe, it, expect } from 'vitest';
import { discover, parseArgs } from './main.js';
import { TOPIC_KEYS } from './criteria.js';
import { seenKey } from './dedupe.js';
import { createTokenBudget } from '../sync-llm/budget.js';
import { TODAY, fakeFetcher, fakeLlm, jsonReply } from '../sync-llm/test-helpers.js';

const SOURCE_URL = 'https://alpine.example/';
const SOURCE_PAGE = 'Alpine Futures Summit. 28 - 29 April 2027, Geneva, Switzerland.';

/** An event as EVENTS_SCHEMA reports it, consistent with SOURCE_PAGE. */
const found = (over = {}) => ({
  title: 'Alpine Futures Summit', full_name: null,
  start_date: '2027-04-28', end_date: '2027-04-29', dates_evidence: '28 - 29 April 2027',
  city: 'Geneva', link: SOURCE_URL, kind: 'summit_or_forum', type: 'summit', topics: ['foresight'],
  subjects: ['Global Affairs'], fit: 'strong', why: 'Leaders discuss the long-term future.',
  ...over,
});

const run = (over = {}) => discover({
  fetcher: fakeFetcher({ [SOURCE_URL]: SOURCE_PAGE }),
  sources: { Alpine: { url: SOURCE_URL } },
  entries: [],
  seen: {},
  today: TODAY,
  budget: createTokenBudget(1_000_000),
  search: false,
  ...over,
});

describe('discover', () => {
  it('drafts an event a source announces', async () => {
    const out = await run({ llm: fakeLlm(jsonReply({ events: [found()] })) });
    expect(out.proposals).toHaveLength(1);
    expect(out.proposals[0]).toMatchObject({
      file: 'summits.yaml',
      entry: { id: 'alpinefuturessummit27', place: 'Geneva, Switzerland', start: '2027-04-28' },
      event: { origin: 'Alpine', fit: 'strong' },
    });
    expect(out.stats).toEqual({ pages: 1, searches: 0 });
  });

  it('lists a possible fit without drafting it', async () => {
    const out = await run({ llm: fakeLlm(jsonReply({ events: [found({ fit: 'possible' })] })) });
    expect(out.proposals).toEqual([]);
    expect(out.possible).toEqual([expect.objectContaining({ title: 'Alpine Futures Summit', origin: 'Alpine' })]);
  });

  it('skips events the calendar lists or an earlier run proposed', async () => {
    const listed = { title: 'Alpine Futures Summit', year: 2027, id: 'afs27', link: 'https://other.example/' };
    const onCalendar = await run({ llm: fakeLlm(jsonReply({ events: [found()] })), entries: [listed] });
    expect(onCalendar.proposals).toEqual([]);
    expect(onCalendar.dropped).toContain('Alpine Futures Summit 2027: already on the calendar as afs27');

    const seen = { [seenKey({ title: 'Alpine Futures Summit', year: 2027 })]: { title: 'Alpine Futures Summit', year: 2027, link: SOURCE_URL } };
    const rejected = await run({ llm: fakeLlm(jsonReply({ events: [found()] })), seen });
    expect(rejected.proposals).toEqual([]);
    expect(rejected.dropped).toContain('Alpine Futures Summit 2027: proposed in an earlier run');
  });

  it('drafts a new edition of a listed event under its existing title and id', async () => {
    const prior = {
      title: 'AFS', full_name: 'Alpine Futures Summit', year: 2026, id: 'afs26',
      sub: 'Global Affairs', type: 'summit', link: SOURCE_URL,
    };
    const out = await run({ llm: fakeLlm(jsonReply({ events: [found()] })), entries: [prior] });
    expect(out.proposals[0].entry).toMatchObject({ title: 'AFS', id: 'afs27', full_name: 'Alpine Futures Summit' });
  });

  it('flags a curated source it cannot read', async () => {
    const out = await run({ llm: fakeLlm(), fetcher: fakeFetcher({}) });
    expect(out.attention).toEqual([`Alpine: ${SOURCE_URL} could not be read (http 404)`]);
  });

  it('proposes an event once when two pages announce it', async () => {
    const other = 'https://mirror.example/';
    const out = await run({
      llm: fakeLlm(jsonReply({ events: [found()] }), jsonReply({ events: [found({ link: other })] })),
      fetcher: fakeFetcher({ [SOURCE_URL]: SOURCE_PAGE, [other]: SOURCE_PAGE }),
      sources: { Alpine: { url: SOURCE_URL }, Mirror: { url: other } },
    });
    expect(out.proposals).toHaveLength(1);
    expect(out.dropped).toContain('Alpine Futures Summit 2027: found twice this run');
  });

  it('drafts an event a later page calls a strong fit', async () => {
    const other = 'https://mirror.example/';
    const out = await run({
      llm: fakeLlm(jsonReply({ events: [found({ fit: 'possible' })] }), jsonReply({ events: [found({ link: other })] })),
      fetcher: fakeFetcher({ [SOURCE_URL]: SOURCE_PAGE, [other]: SOURCE_PAGE }),
      sources: { Alpine: { url: SOURCE_URL }, Mirror: { url: other } },
    });
    expect(out.proposals.map((p) => p.event.origin)).toEqual(['Mirror']);
    expect(out.possible).toEqual([]);
  });

  it('keeps apart two events whose only link is the listing they were found on', async () => {
    const page = `${SOURCE_PAGE} Lakeside Dialogue. 3 - 4 June 2027, Lausanne.`;
    const second = found({
      title: 'Lakeside Dialogue', start_date: '2027-06-03', end_date: '2027-06-04',
      dates_evidence: '3 - 4 June 2027', city: 'Lausanne',
    });
    const out = await run({
      llm: fakeLlm(jsonReply({ events: [found(), second] })),
      fetcher: fakeFetcher({ [SOURCE_URL]: page }),
    });
    expect(out.proposals.map((p) => p.entry.id)).toEqual(['alpinefuturessummit27', 'lakesidedialogue27']);
  });

  it('reports a failed model call and reads on', async () => {
    const other = 'https://mirror.example/';
    let calls = 0;
    const llm = {
      respond: async () => {
        calls += 1;
        if (calls === 1) throw new Error('400 invalid prompt');
        return jsonReply({ events: [found({ link: other })] });
      },
    };
    const out = await run({
      llm,
      fetcher: fakeFetcher({ [SOURCE_URL]: SOURCE_PAGE, [other]: SOURCE_PAGE }),
      sources: { Alpine: { url: SOURCE_URL }, Mirror: { url: other } },
    });
    expect(out.attention).toEqual([`Alpine: no usable extraction from ${SOURCE_URL} (400 invalid prompt)`]);
    expect(out.proposals).toHaveLength(1);
  });

  it('does not read a page again when a lead redirects to it', async () => {
    const alias = 'https://alias.example/';
    const llm = fakeLlm(jsonReply({ events: [] }), jsonReply({ leads: [{ name: 'Alpine', url: alias }] }));
    const out = await run({
      llm,
      fetcher: fakeFetcher({ [SOURCE_URL]: SOURCE_PAGE, [alias]: { text: SOURCE_PAGE, finalUrl: SOURCE_URL } }),
      search: true,
    });
    expect(out.stats.pages).toBe(1);
    expect(llm.requests).toHaveLength(1 + TOPIC_KEYS.length);
  });

  it('reads web search leads after the sources, telling each search what is already known', async () => {
    const leadUrl = 'https://lead.example/';
    const leadPage = 'Lakeside Dialogue. 3 - 4 June 2027, Lausanne.';
    const lead = found({
      title: 'Lakeside Dialogue', start_date: '2027-06-03', end_date: '2027-06-04',
      dates_evidence: '3 - 4 June 2027', city: 'Lausanne', link: leadUrl,
    });
    const llm = fakeLlm(
      jsonReply({ events: [found()] }),
      { ...jsonReply({ leads: [{ name: 'Lakeside Dialogue', url: leadUrl }] }), output: [{ type: 'web_search_call' }] },
      jsonReply({ events: [lead] }),
      ...TOPIC_KEYS.slice(1).map(() => jsonReply({ leads: [] })),
    );
    const out = await run({
      llm,
      fetcher: fakeFetcher({ [SOURCE_URL]: SOURCE_PAGE, [leadUrl]: leadPage }),
      search: true,
    });
    expect(out.proposals.map((p) => p.entry.id)).toEqual(['alpinefuturessummit27', 'lakesidedialogue27']);
    expect(out.proposals[1].event.origin).toBe('web search, humanitarian aid and international cooperation');
    expect(out.stats).toEqual({ pages: 2, searches: 1 });
    expect(llm.requests[3].input[0].content).toContain('Lakeside Dialogue 2027');
    expect(out.attention).toEqual([]);
  });

  it('stops reading once the run budget is spent', async () => {
    const budget = createTokenBudget(10);
    budget.addUsage({ input_tokens: 11 });
    const out = await run({ llm: fakeLlm(), budget });
    expect(out.stats.pages).toBe(0);
    expect(out.attention).toEqual(['run token budget exhausted; the remaining pages were not read']);
  });
});

describe('parseArgs', () => {
  it('reads the flags and rejects typos', () => {
    expect(parseArgs([])).toEqual({ dryRun: false, search: true });
    expect(parseArgs(['--', '--dry-run', '--no-search'])).toEqual({ dryRun: true, search: false });
    expect(() => parseArgs(['--dryrun'])).toThrow(/unknown argument/);
  });
});
