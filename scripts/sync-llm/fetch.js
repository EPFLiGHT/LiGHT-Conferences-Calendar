import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import net from 'net';
import { lookup as dnsLookup } from 'dns/promises';

/**
 * Everything this sync does over the network, and the hygiene around it.
 *
 * URLs are normalized so the same page is never fetched twice under two names,
 * and checked against an SSRF guard, because in the agent tiers the URL is
 * chosen by a model reading untrusted web pages. HTML is reduced to text with
 * regexes rather than a parser: deadline pages are simple, and table cells only
 * need to stay separated so date rows survive. Links come out of the page too,
 * as the map the agent navigates by.
 */

/** Pages with less reduced text than this are treated as JS-rendered. */
export const MIN_TEXT_CHARS = 200;
/** ~8k tokens at ~4 chars/token; pages are truncated to this many chars. */
const MAX_TEXT_CHARS = 32_000;

const PRIVATE_HOST_RE =
  /^(localhost$|0\.|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|\[?::1?\]?$|\[?::ffff:|\[?fe[89ab][0-9a-f]:|\[?f[cd][0-9a-f]{2}:)/i;

// The regex screens hostname strings; these ranges screen what they resolve to.
const PRIVATE_RANGES = new net.BlockList();
PRIVATE_RANGES.addSubnet('0.0.0.0', 8);
PRIVATE_RANGES.addSubnet('10.0.0.0', 8);
PRIVATE_RANGES.addSubnet('100.64.0.0', 10);
PRIVATE_RANGES.addSubnet('127.0.0.0', 8);
PRIVATE_RANGES.addSubnet('169.254.0.0', 16);
PRIVATE_RANGES.addSubnet('172.16.0.0', 12);
PRIVATE_RANGES.addSubnet('192.168.0.0', 16);
PRIVATE_RANGES.addAddress('::1', 'ipv6');
PRIVATE_RANGES.addSubnet('fc00::', 7, 'ipv6');
PRIVATE_RANGES.addSubnet('fe80::', 10, 'ipv6');

function isPrivateAddress(addr) {
  const bare = addr.replace(/^\[|\]$/g, '');
  const mapped = bare.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const ip = mapped ? mapped[1] : bare;
  const family = net.isIP(ip);
  if (family === 0) return true;
  return PRIVATE_RANGES.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

/**
 * Canonical form used for caching and duplicate detection.
 * @param {string} raw Any absolute URL.
 * @returns {string} Lowercased host, no fragment, no trailing slash (root keeps its slash).
 */
export function normalizeUrl(raw) {
  const u = new URL(raw);
  u.hash = '';
  u.host = u.host.toLowerCase();
  let s = u.toString();
  if (u.pathname !== '/' && s.endsWith('/')) s = s.slice(0, -1);
  return s;
}

/**
 * SSRF guard: only public http(s) targets may be fetched, including any
 * URL the model asks for and any redirect destination.
 * @param {string} raw URL to check.
 * @returns {{ok: boolean, reason?: string}}
 */
export function isAllowedUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: 'malformed URL' };
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, reason: 'only http(s) URLs are allowed' };
  }
  if (PRIVATE_HOST_RE.test(u.hostname)) {
    return { ok: false, reason: 'private or loopback host' };
  }
  return { ok: true };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-' };

function decodeEntities(s) {
  return s
    // String.fromCodePoint throws past 0x10FFFF; substitute like a browser would.
    .replace(/&#(\d+);/g, (_, n) => (Number(n) <= 0x10ffff ? String.fromCodePoint(Number(n)) : '�'))
    .replace(/&(amp|lt|gt|quot|apos|nbsp|ndash|mdash);/g, (_, name) => ENTITIES[name]);
}

/**
 * Reduce HTML to readable text. Regex-based on purpose: good enough for
 * deadline pages, zero dependencies. Table cells become " | " so date rows
 * survive; block-level closers become newlines.
 * @param {string} html Raw HTML.
 * @returns {string} Cleaned text with single spaces and single newlines.
 */
export function htmlToText(html) {
  let s = html
    .replace(/<(script|style|noscript|svg|head|nav|footer)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|tr|table|h[1-6]|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n[ \n]*/g, '\n')
    .trim();
}

/**
 * Extract the page's links for the agent to choose from.
 * @param {string} html Raw HTML.
 * @param {string} baseUrl URL the page was fetched from (resolves relative hrefs).
 * @returns {Array<{text: string, href: string}>} Absolute, allowed, deduped by href, max 200.
 */
export function extractLinks(html, baseUrl) {
  const links = [];
  const seen = new Set();
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (const m of html.matchAll(re)) {
    let href;
    try {
      href = normalizeUrl(new URL(m[1], baseUrl).toString());
    } catch {
      continue;
    }
    if (!isAllowedUrl(href).ok || seen.has(href)) continue;
    const text = htmlToText(m[2]).replace(/\s+/g, ' ').trim();
    if (!text) continue;
    seen.add(href);
    links.push({ text, href });
    if (links.length >= 200) break;
  }
  return links;
}

const USER_AGENT =
  'LiGHT-Conferences-Calendar sync bot (https://github.com/EPFLiGHT/Conferences-Calendar)';

/**
 * A page fetcher that behaves itself on other people's servers. It holds one
 * request per host at a time with a delay between them, keeps every page it has
 * successfully read in memory so a venue is never fetched twice across tiers
 * (failures are not kept, so a later tier can retry them), caps the download at
 * 2 MB, and follows redirects by hand so that each hop clears the SSRF guard,
 * string and DNS halves both, before it is requested rather than after.
 *
 * Point SYNC_LLM_CACHE_DIR at a directory to cache pages on disk as well, which
 * makes iterating on prompts free and keeps venue sites out of it.
 * @param {object} [opts] Defaults suit production; tests override fetchImpl,
 *   sleep and the delays, and pass offline to forbid unexpected requests.
 */
export function createFetcher({
  fetchImpl = fetch,
  cacheDir = process.env.SYNC_LLM_CACHE_DIR,
  offline = false,
  hostDelayMs = 1000,
  timeoutMs = 15_000,
  maxBytes = 2_000_000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  lookup = (host, opts) => dnsLookup(host, opts),
} = {}) {
  const MAX_REDIRECTS = 5;
  const cache = new Map(); // normalized URL -> page result (or, while in flight, its promise)
  const lastHit = new Map(); // host -> timestamp
  const hostQueue = new Map(); // host -> tail promise, so only one request per host runs at a time

  function diskPath(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
    return path.join(cacheDir, `${hash}.json`);
  }

  /** Runs task() after any request already queued for host has finished. */
  function runOnHostQueue(host, task) {
    const prevTail = hostQueue.get(host) ?? Promise.resolve();
    const tail = prevTail.then(task, task);
    hostQueue.set(host, tail.then(
      () => undefined,
      () => undefined,
    ));
    return tail;
  }

  /** DNS half of the SSRF guard. Lookup failures pass so the fetch reports the
   *  real DNS error instead of a misleading "private". Best effort: the fetch
   *  resolves again on its own, so a rebinding attacker can race the lookups. */
  async function assertResolvesPublic(url) {
    const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(hostname)) {
      if (isPrivateAddress(hostname)) throw new Error(`private address ${hostname}`);
      return;
    }
    let addrs;
    try {
      addrs = await lookup(hostname, { all: true });
    } catch {
      return;
    }
    const bad = addrs.find((a) => isPrivateAddress(a.address));
    if (bad) throw new Error(`host ${hostname} resolves to private address ${bad.address}`);
  }

  async function fetchRaw(url) {
    if (cacheDir) {
      const p = diskPath(url);
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    if (offline) throw new Error('offline mode and not in cache');
    const host = new URL(url).host;
    const raw = await runOnHostQueue(host, async () => {
      const wait = hostDelayMs - (Date.now() - (lastHit.get(host) ?? 0));
      if (wait > 0) await sleep(wait);
      lastHit.set(host, Date.now());
      let current = url;
      // One deadline for the whole redirect chain. Per-hop timeouts would let a
      // redirecting host hold a single fetchPage for timeoutMs * (MAX_REDIRECTS
      // + 1), which no budget upstream samples often enough to interrupt.
      const signal = AbortSignal.timeout(timeoutMs);
      for (let hop = 0; ; hop++) {
        // Every hop, not just the first: a redirect can change hosts.
        await assertResolvesPublic(current);
        const res = await fetchImpl(current, {
          redirect: 'manual',
          signal,
          headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
        });
        const location =
          res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (!location) {
          const buf = await res.arrayBuffer();
          return {
            status: res.status,
            ok: res.ok,
            finalUrl: current,
            html: new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, maxBytes)),
          };
        }
        if (hop >= MAX_REDIRECTS) throw new Error(`too many redirects at ${current}`);
        const next = new URL(location, current).toString();
        // Check the hop before requesting it: a redirect must never reach a private host.
        const allowed = isAllowedUrl(next);
        if (!allowed.ok) throw new Error(`redirect to disallowed URL ${next}`);
        current = next;
      }
    });
    // A cached redirect to a disallowed host would bypass the guard, and a
    // cached 5xx would replay a transient failure on every later run.
    if (cacheDir && raw.ok && isAllowedUrl(raw.finalUrl).ok) {
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(diskPath(url), JSON.stringify(raw));
    }
    return raw;
  }

  return {
    fetchPage(url) {
      const allowed = isAllowedUrl(url);
      if (!allowed.ok) return Promise.resolve({ ok: false, error: allowed.reason });
      const key = normalizeUrl(url);
      if (cache.has(key)) return Promise.resolve(cache.get(key));

      const pending = (async () => {
        let result;
        try {
          const raw = await fetchRaw(key);
          if (!isAllowedUrl(raw.finalUrl).ok) {
            result = { ok: false, error: `redirect to disallowed URL ${raw.finalUrl}` };
          } else if (!raw.ok) {
            result = {
              ok: false,
              status: raw.status,
              finalUrl: normalizeUrl(raw.finalUrl),
              error: `http ${raw.status}`,
            };
          } else {
            const text = htmlToText(raw.html).slice(0, MAX_TEXT_CHARS);
            result = {
              ok: true,
              status: raw.status,
              finalUrl: normalizeUrl(raw.finalUrl),
              text,
              links: extractLinks(raw.html, raw.finalUrl),
              tooShort: text.length < MIN_TEXT_CHARS,
            };
          }
        } catch (err) {
          result = { ok: false, error: err.message };
        }
        if (result.ok) {
          // Swap in the settled value so getText/hasFetched can read it synchronously.
          cache.set(key, result);
          // Also key by the post-redirect URL (the one the model cites),
          // without stealing a key an in-flight fetch already owns.
          if (result.finalUrl && result.finalUrl !== key && !cache.has(result.finalUrl)) {
            cache.set(result.finalUrl, result);
          }
        } else {
          // Never cache failures; the agent tiers exist to retry them.
          cache.delete(key);
        }
        return result;
      })();

      // Cache the promise itself so concurrent callers share one request.
      cache.set(key, pending);
      return pending;
    },
    getText(url) {
      try {
        const hit = cache.get(normalizeUrl(url));
        return hit && !(hit instanceof Promise) && hit.ok ? hit.text : null;
      } catch {
        return null;
      }
    },
    hasFetched(url) {
      try {
        const hit = cache.get(normalizeUrl(url));
        return !!hit && !(hit instanceof Promise) && hit.ok === true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Keyless web search via DuckDuckGo's HTML endpoint; best effort, [] on any
 * failure. Result hrefs are either direct or ddg redirect links carrying the
 * target in the uddg query param.
 * @param {string} query Search query.
 * @param {{fetchImpl?: typeof fetch}} [opts]
 * @returns {Promise<Array<{title: string, url: string}>>} Top 5 results.
 */
export async function searchWeb(query, { fetchImpl = fetch } = {}) {
  try {
    const res = await fetchImpl(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(15_000) },
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
      if (results.length >= 5) break;
    }
    return results;
  } catch {
    return [];
  }
}
