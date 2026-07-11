/**
 * The fallback for venues whose configured URL went stale or moved: a
 * function-calling loop where the model fetches pages, and in tier 2 searches
 * the web, until it finds the deadlines and submits them.
 *
 * The model decides where to go; this file is the walls around it. A run ends
 * when it spends its turns, tokens or seconds, when it fetches the same page
 * three times, or when it stops calling tools altogether. Every URL is checked
 * before it is requested, searches are capped, and a submission is refused
 * unless its source_url is a page the run actually fetched.
 */
import { functionCalls } from './llm.js';
import { isAllowedUrl, normalizeUrl, searchWeb } from './fetch.js';
import { EDITIONS_SCHEMA, PAGE_RULES, dateContext } from './extract.js';

const MAX_SEARCHES = 2;
const MAX_LINKS_SHOWN = 100;

function buildTools(searchEnabled) {
  const tools = [
    {
      type: 'function',
      name: 'fetch_page',
      description: 'Fetch a public web page. Returns cleaned text plus the links on it.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
    {
      type: 'function',
      name: 'submit',
      description: 'Finish. Either report the editions found (with source_url of the page they came from) or not_found with a reason.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          not_found: { type: 'boolean' },
          reason: { type: ['string', 'null'] },
          source_url: { type: ['string', 'null'] },
          editions: EDITIONS_SCHEMA.schema.properties.editions,
        },
        required: ['not_found', 'reason', 'source_url', 'editions'],
      },
    },
  ];
  if (searchEnabled) {
    tools.splice(1, 0, {
      type: 'function',
      name: 'search_web',
      description: 'Web search; use only after fetching has failed. Returns top results.',
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    });
  }
  return tools;
}

/**
 * @param {object} deps { llm, fetcher, search?, budget, venueTitle, startUrl, today, searchEnabled? }
 * @returns {Promise<{outcome: 'submitted', editions: Array, sourceUrl: string}
 *   | {outcome: 'not_found', reason: string}
 *   | {outcome: 'aborted', reason: string}>}
 */
export async function runAgent({
  llm,
  fetcher,
  search = searchWeb,
  budget,
  venueTitle,
  startUrl,
  today,
  searchEnabled = false,
}) {
  const tools = buildTools(searchEnabled);
  const { maxTurns } = budget.limits();
  const allowance =
    `You have at most ${maxTurns} tool calls` +
    (searchEnabled ? ` and ${MAX_SEARCHES} web searches` : '') +
    '. Spend them deliberately; when they run out the run is abandoned.';
  const input = [
    {
      role: 'system',
      content:
        `You locate the official deadlines of the research conference "${venueTitle}". ` +
        `Start from ${startUrl}. Follow only links that plausibly lead to important dates ` +
        `or a call for papers. When you have found the deadlines, call submit with the ` +
        `editions and the URL of the page they appear on. If you cannot find them, call ` +
        `submit with not_found. ${allowance}\n` +
        'Every evidence quote you submit must be copied from the same page you name in ' +
        'source_url. If the deadlines you want are spread over several pages, submit the ' +
        'one page that carries them, and never quote a page you did not fetch.\n' +
        `${dateContext(today)}\n${PAGE_RULES}`,
    },
    { role: 'user', content: `Find the current submission deadlines for ${venueTitle}.` },
  ];

  const fetchCounts = new Map();
  // The fetcher is shared across venues and tiers, so track provenance here:
  // submit may only cite a page this run fetched itself.
  const fetchedThisRun = new Set();
  let nudged = false;
  let searches = 0;

  while (true) {
    const tripped = budget.exceeded();
    if (tripped) return { outcome: 'aborted', reason: `budget ${tripped}` };

    const res = await llm.respond({ input, tools });
    input.push(...(res.output ?? []));
    const calls = functionCalls(res);

    if (calls.length === 0) {
      if (nudged) return { outcome: 'aborted', reason: 'no progress' };
      nudged = true;
      input.push({ role: 'user', content: 'Call one of your tools, or call submit.' });
      continue;
    }

    for (const { name, args, call_id } of calls) {
      budget.turn();
      const over = budget.exceeded();
      if (over) return { outcome: 'aborted', reason: `budget ${over}` };

      let output;
      if (!args) {
        output = { error: 'arguments were not valid JSON' };
      } else if (name === 'submit') {
        if (args.not_found) {
          return { outcome: 'not_found', reason: args.reason ?? 'not found' };
        }
        let srcKey = null;
        try {
          srcKey = args.source_url ? normalizeUrl(args.source_url) : null;
        } catch { /* malformed source_url; refused below */ }
        if (!srcKey || !fetchedThisRun.has(srcKey)) {
          output = { error: 'source_url must be a page you fetched this run' };
        } else {
          return { outcome: 'submitted', editions: args.editions ?? [], sourceUrl: srcKey };
        }
      } else if (name === 'fetch_page') {
        const allowed = isAllowedUrl(args.url ?? '');
        if (!allowed.ok) {
          output = { error: allowed.reason };
        } else {
          const key = normalizeUrl(args.url);
          const count = (fetchCounts.get(key) ?? 0) + 1;
          fetchCounts.set(key, count);
          if (count >= 3) return { outcome: 'aborted', reason: 'stuck refetching the same URL' };
          const page = await fetcher.fetchPage(args.url);
          if (page.ok) {
            fetchedThisRun.add(key);
            if (page.finalUrl) fetchedThisRun.add(normalizeUrl(page.finalUrl));
          }
          output = page.ok
            ? {
                final_url: page.finalUrl,
                text: page.text,
                links: page.links.slice(0, MAX_LINKS_SHOWN),
                note: count > 1 ? 'you already fetched this URL; do not fetch it again' : undefined,
              }
            : { error: page.error };
        }
      } else if (name === 'search_web') {
        if (!searchEnabled) {
          output = { error: 'search is not available; use fetch_page' };
        } else if (searches >= MAX_SEARCHES) {
          output = { error: 'search budget exhausted; submit what you have' };
        } else {
          searches += 1;
          output = { results: await search(args.query ?? '') };
        }
      } else {
        output = { error: `unknown tool ${name}` };
      }

      input.push({ type: 'function_call_output', call_id, output: JSON.stringify(output) });
    }
  }
}
