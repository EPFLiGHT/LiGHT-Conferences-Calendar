// The only part of the sync that downloads venue pages; every URL and redirect passes the SSRF guard in urls.js.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { lookup as dnsLookup } from 'dns/promises';
import { setTimeout as sleep } from 'timers/promises';
import { normalizeUrl, isAllowedUrl, assertResolvesPublic } from './urls.js';
import { htmlToText, extractLinks } from './html.js';

/** Pages with less reduced text than this are treated as JS-rendered. */
const MIN_TEXT_CHARS = 200;
/** ~8k tokens at ~4 chars/token; pages are truncated to this many chars. */
const MAX_TEXT_CHARS = 32_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;

export const USER_AGENT =
  'LiGHT-Conferences-Calendar sync bot (https://github.com/EPFLiGHT/Conferences-Calendar)';

async function readCapped(res, maxBytes) {
  if (!res.body) return Buffer.alloc(0);
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) return Buffer.concat(chunks);
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => {});
  return Buffer.concat(chunks).subarray(0, maxBytes);
}

/**
 * A page fetcher that holds one request per host at a time with a delay
 * between them, keeps every page it has successfully read in memory so a venue
 * is never fetched twice across tiers (failures are not kept, so a later tier
 * can retry them), caps the download at maxBytes, and follows redirects by hand
 * so that each hop clears the SSRF guard, string and DNS halves both, before it
 * is requested rather than after.
 *
 * Point SYNC_LLM_CACHE_DIR at a directory to cache pages on disk as well, which
 * makes iterating on prompts free and keeps venue sites out of it.
 * @param {object} [opts] Defaults suit production; tests override fetchImpl,
 *   lookup, the host delay and the byte cap.
 * @returns {{fetchPage: (url: string) => Promise<object>, getText: (url: string) => string|null}}
 *   getText returns the text of a page this fetcher has already read.
 */
export function createFetcher({
  fetchImpl = fetch,
  cacheDir = process.env.SYNC_LLM_CACHE_DIR,
  hostDelayMs = 1000,
  maxBytes = 2_000_000,
  lookup = (host, opts) => dnsLookup(host, opts),
} = {}) {
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

  async function fetchRaw(url) {
    if (cacheDir) {
      const p = diskPath(url);
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
    const host = new URL(url).host;
    const raw = await runOnHostQueue(host, async () => {
      const wait = hostDelayMs - (Date.now() - (lastHit.get(host) ?? 0));
      if (wait > 0) await sleep(wait);
      lastHit.set(host, Date.now());
      let current = url;
      // One deadline for the whole redirect chain. Per-hop timeouts would let a
      // redirecting host hold a single fetchPage for TIMEOUT_MS * (MAX_REDIRECTS
      // + 1), which no budget upstream samples often enough to interrupt.
      const signal = AbortSignal.timeout(TIMEOUT_MS);
      for (let hop = 0; ; hop++) {
        // Every hop, not just the first: a redirect can change hosts.
        await assertResolvesPublic(current, lookup);
        const res = await fetchImpl(current, {
          redirect: 'manual',
          signal,
          headers: { 'user-agent': USER_AGENT, accept: 'text/html,*/*' },
        });
        const location =
          res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
        if (!location) {
          const buf = await readCapped(res, maxBytes);
          return {
            status: res.status,
            ok: res.ok,
            finalUrl: current,
            html: new TextDecoder('utf-8', { fatal: false }).decode(buf),
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
          // Swap in the settled value so getText can read it synchronously.
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
  };
}
