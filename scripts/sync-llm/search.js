/**
 * Keyless web search for the tier-2 agent, via DuckDuckGo's HTML endpoint.
 */
import { isAllowedUrl } from './urls.js';
import { htmlToText } from './html.js';
import { USER_AGENT } from './fetcher.js';

const MAX_RESULTS = 5;
const TIMEOUT_MS = 15_000;

/**
 * Search the web; best effort, [] on any failure. Result hrefs are either
 * direct or ddg redirect links carrying the target in the uddg query param.
 * @param {string} query Search query.
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<Array<{title: string, url: string}>>} Top 5 allowed results.
 */
export async function searchWeb(query, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    const html = new TextDecoder().decode(await res.arrayBuffer());
    const results = [];
    const re = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a/gi;
    for (const m of html.matchAll(re)) {
      let url = m[1];
      const uddg = url.match(/[?&]uddg=([^&]+)/);
      if (uddg) url = decodeURIComponent(uddg[1]);
      if (!isAllowedUrl(url).ok) continue;
      results.push({ title: htmlToText(m[2]).trim(), url });
      if (results.length >= MAX_RESULTS) break;
    }
    return results;
  } catch {
    return [];
  }
}
