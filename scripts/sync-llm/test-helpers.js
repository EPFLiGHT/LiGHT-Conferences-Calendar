/**
 * Fixtures and fakes shared by the sync-llm tests. Not collected as a test
 * file itself (vitest only runs *.test.js).
 */
import { DateTime } from 'luxon';
import { createLlm } from './llm.js';

export const TODAY = DateTime.fromISO('2026-07-08T12:00:00Z', { zone: 'utc' });

/** A deadline as EDITIONS_SCHEMA reports it. */
export const deadline = (over = {}) => ({
  kind: 'paper', date: '2026-09-15', time: null, timezone_text: null,
  evidence: 'Paper deadline: September 15, 2026',
  ...over,
});

/** An edition as EDITIONS_SCHEMA reports it, with one paper deadline. */
export const edition = (over = {}) => ({
  year: 2026, full_name: null, location: null, start_date: null, end_date: null, dates_evidence: null,
  deadlines: [deadline()],
  ...over,
});

/**
 * A fetcher serving `pages`, each a URL mapped to its text or to
 * {text, finalUrl} for a redirect; any other URL 404s.
 */
export function fakeFetcher(pages = {}) {
  const texts = new Map();
  return {
    async fetchPage(url) {
      const page = pages[url];
      if (page == null) return { ok: false, error: 'http 404', status: 404 };
      const { text, finalUrl } = typeof page === 'string' ? { text: page, finalUrl: url } : page;
      texts.set(url, text);
      texts.set(finalUrl, text);
      return { ok: true, status: 200, finalUrl, text, links: [], tooShort: false };
    },
    getText: (url) => texts.get(url) ?? null,
  };
}

let callCount = 0;

/** A function_call output item, as the Responses API returns it. */
export const call = (name, args) => ({
  type: 'function_call', name, arguments: JSON.stringify(args), call_id: `call${++callCount}`,
});

/** A reply that calls the given tools. */
export const toolReply = (...calls) => ({ output: calls });

/** A structured-output reply carrying value as JSON. */
export const jsonReply = (value) => ({ output_text: JSON.stringify(value) });

/**
 * createLlm over a fake client that answers with `replies` in order, then with
 * empty replies. `requests` records every request the client received.
 */
export function fakeLlm(...replies) {
  const queue = [...replies];
  const requests = [];
  const client = {
    responses: {
      create: async (req) => {
        requests.push(req);
        return { output: [], output_text: '', usage: {}, ...queue.shift() };
      },
    },
  };
  return { ...createLlm({ client }), requests };
}

/** A fetch Response stand-in. */
export function fakeResponse({ status = 200, url, body = '', headers = {} } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    headers: { get: (k) => headers[k.toLowerCase()] ?? null },
    body: new Response(body).body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}
