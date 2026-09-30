import fs from 'fs';
import os from 'os';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { createFetcher as createFetcherReal } from './fetcher.js';
import { fakeResponse } from './test-helpers.js';

const HTML = fs.readFileSync(new URL('./fixtures/dates-page.html', import.meta.url), 'utf8');

// Tests stay hermetic: resolve every host to a public address unless a test
// injects its own lookup to exercise the DNS guard.
const publicLookup = async () => [{ address: '203.0.113.7', family: 4 }];
const createFetcher = (opts = {}) => createFetcherReal({ lookup: publicLookup, ...opts });

describe('createFetcher', () => {
  it('fetches, reduces and links a page', async () => {
    const fetchImpl = async (url) => fakeResponse({ url, body: HTML });
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    const page = await f.fetchPage('https://fixture.example/2026/dates');
    expect(page.ok).toBe(true);
    expect(page.text).toContain('Abstract submission deadline');
    expect(page.links.length).toBeGreaterThan(0);
    expect(page.tooShort).toBe(false);
  });

  it('stops downloading once the byte cap is reached', async () => {
    const CHUNK = 64 * 1024;
    let pulled = 0;
    const huge = new ReadableStream({
      pull(controller) {
        if (pulled >= 50 * 1024 * 1024) return controller.close();
        pulled += CHUNK;
        controller.enqueue(new Uint8Array(CHUNK).fill(97));
      },
    });
    const fetchImpl = async () => new Response(huge, { status: 200 });
    const f = createFetcher({ fetchImpl, hostDelayMs: 0, maxBytes: 100_000 });
    const page = await f.fetchPage('https://huge.example/');
    expect(page.ok).toBe(true);
    expect(pulled).toBeLessThanOrEqual(100_000 + 2 * CHUNK);
  });

  it('serves the in-run cache on a second fetch of the same URL', async () => {
    let calls = 0;
    const fetchImpl = async (url) => { calls += 1; return fakeResponse({ url, body: HTML }); };
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    await f.fetchPage('https://fixture.example/dates');
    await f.fetchPage('https://fixture.example/dates/#frag');
    expect(calls).toBe(1);
  });

  it('flags short pages as tooShort (JS-only heuristic)', async () => {
    const fetchImpl = async (url) => fakeResponse({ url, body: '<html><body><div id="app"></div></body></html>' });
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    const page = await f.fetchPage('https://spa.example/');
    expect(page.ok).toBe(true);
    expect(page.tooShort).toBe(true);
  });

  it('rejects disallowed URLs without calling the network', async () => {
    let calls = 0;
    const f = createFetcher({ fetchImpl: async () => { calls += 1; }, hostDelayMs: 0 });
    const page = await f.fetchPage('http://127.0.0.1/secrets');
    expect(page.ok).toBe(false);
    expect(page.error).toMatch(/private or loopback/);
    expect(calls).toBe(0);
  });

  it('rejects a redirect to a disallowed host without ever requesting it', async () => {
    const requested = [];
    const fetchImpl = async (url) => {
      requested.push(url);
      return fakeResponse({ status: 301, url, headers: { location: 'http://127.0.0.1/x' } });
    };
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    const page = await f.fetchPage('https://fixture.example/redirects');
    expect(page.ok).toBe(false);
    expect(page.error).toMatch(/redirect/);
    expect(requested).toEqual(['https://fixture.example/redirects']);
  });

  it('caps redirect chains', async () => {
    let n = 0;
    const fetchImpl = async (url) => {
      n += 1;
      return fakeResponse({ status: 301, url, headers: { location: `https://fixture.example/r${n}` } });
    };
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    const page = await f.fetchPage('https://fixture.example/r0');
    expect(page.ok).toBe(false);
    expect(page.error).toMatch(/too many redirects/);
  });

  it('reports http errors as ok:false with the status', async () => {
    const fetchImpl = async (url) => fakeResponse({ status: 404, url, body: 'nope' });
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    const page = await f.fetchPage('https://fixture.example/gone');
    expect(page.ok).toBe(false);
    expect(page.status).toBe(404);
  });

  it('retries a transient failure instead of serving it from the cache', async () => {
    let calls = 0;
    const fetchImpl = async (url) => {
      calls += 1;
      if (calls === 1) throw new Error('socket hang up');
      return fakeResponse({ url, body: HTML });
    };
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    const first = await f.fetchPage('https://fixture.example/dates');
    expect(first.ok).toBe(false);
    const second = await f.fetchPage('https://fixture.example/dates');
    expect(second.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it('does not persist http errors to the disk cache', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-llm-cache-'));
    const fetchImpl = async (url) => fakeResponse({ status: 500, url, body: 'flaky' });
    const f = createFetcher({ fetchImpl, hostDelayMs: 0, cacheDir });
    await f.fetchPage('https://fixture.example/flaky');
    expect(fs.readdirSync(cacheDir)).toHaveLength(0);
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it.each([
    ['::ffff:127.0.0.1', 6],
    ['::', 6],
    ['fe80::1', 6],
    ['100.64.0.1', 4],
  ])('blocks a host that resolves to %s', async (address, family) => {
    let calls = 0;
    const fetchImpl = async (url) => { calls += 1; return fakeResponse({ url, body: HTML }); };
    const f = createFetcher({ fetchImpl, hostDelayMs: 0, lookup: async () => [{ address, family }] });
    const page = await f.fetchPage('https://rebind.example/');
    expect(page.ok).toBe(false);
    expect(page.error).toMatch(/private/);
    expect(calls).toBe(0);
  });

  it('blocks hosts that resolve to private addresses without fetching them', async () => {
    let calls = 0;
    const fetchImpl = async (url) => { calls += 1; return fakeResponse({ url, body: HTML }); };
    const lookup = async () => [{ address: '169.254.169.254', family: 4 }];
    const f = createFetcher({ fetchImpl, hostDelayMs: 0, lookup });
    const page = await f.fetchPage('http://metadata.internal.example/');
    expect(page.ok).toBe(false);
    expect(page.error).toMatch(/private/);
    expect(calls).toBe(0);
  });

  it('still fetches hosts whose DNS lookup fails, so fetch reports the real error', async () => {
    const fetchImpl = async (url) => fakeResponse({ url, body: HTML });
    const lookup = async () => { throw new Error('ENOTFOUND'); };
    const f = createFetcher({ fetchImpl, hostDelayMs: 0, lookup });
    const page = await f.fetchPage('https://fixture.example/dates');
    expect(page.ok).toBe(true);
  });

  it('exposes fetched text for evidence checks', async () => {
    const fetchImpl = async (url) => fakeResponse({ url, body: HTML });
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    await f.fetchPage('https://fixture.example/dates');
    expect(f.getText('https://fixture.example/dates')).toContain('May 6, 2026');
    expect(f.getText('https://other.example/')).toBeNull();
  });

  it('returns null from getText for a malformed URL instead of throwing', async () => {
    const f = createFetcher({ fetchImpl: async () => fakeResponse({ url: 'x', body: '' }), hostDelayMs: 0 });
    expect(f.getText('not a url')).toBeNull();
  });

  it('normalizes finalUrl on the http-error path too', async () => {
    const fetchImpl = async (url) =>
      url.includes('/Gone')
        ? fakeResponse({ status: 404, url, body: 'nope' })
        : fakeResponse({ status: 301, url, headers: { location: 'https://Fixture.example/Gone/#frag' } });
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    const page = await f.fetchPage('https://fixture.example/gone');
    expect(page.ok).toBe(false);
    expect(page.finalUrl).toBe('https://fixture.example/Gone');
  });

  it('does not write a disallowed redirect to the disk cache', async () => {
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-llm-cache-'));
    const fetchImpl = async (url) =>
      fakeResponse({ status: 301, url, headers: { location: 'http://127.0.0.1/x' } });
    const f = createFetcher({ fetchImpl, hostDelayMs: 0, cacheDir });
    await f.fetchPage('https://fixture.example/redirects');
    const files = fs.readdirSync(cacheDir);
    expect(files.length).toBe(0);
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('serializes requests to the same host, one at a time with the host delay', async () => {
    const events = [];
    const fetchImpl = async (url) => {
      events.push({ type: 'start', url, t: Date.now() });
      await new Promise((r) => setTimeout(r, 30));
      events.push({ type: 'end', url, t: Date.now() });
      return fakeResponse({ url, body: HTML });
    };
    const f = createFetcher({ fetchImpl, hostDelayMs: 10 });
    await Promise.all([
      f.fetchPage('https://fixture.example/a'),
      f.fetchPage('https://fixture.example/b'),
    ]);
    expect(events.map((e) => e.type)).toEqual(['start', 'end', 'start', 'end']);
    // The second request must start only after the first finished (plus the host delay).
    const firstEnd = events[1].t;
    const secondStart = events[2].t;
    expect(secondStart).toBeGreaterThanOrEqual(firstEnd);
  });

  it('aliases the final URL after a redirect so getText and fetchPage work on it too', async () => {
    let calls = 0;
    const fetchImpl = async (url) => {
      calls += 1;
      return url.startsWith('https://www.')
        ? fakeResponse({ url, body: HTML })
        : fakeResponse({ status: 301, url, headers: { location: 'https://www.conf.example/dates' } });
    };
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    await f.fetchPage('https://conf.example/dates');
    expect(f.getText('https://www.conf.example/dates')).toContain('Abstract submission deadline');
    await f.fetchPage('https://www.conf.example/dates');
    // 2 calls for the chain (original + redirect target), none for the cache hit.
    expect(calls).toBe(2);
  });

  it('dedups concurrent fetchPage calls for the same URL into one network call', async () => {
    let calls = 0;
    const fetchImpl = async (url) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return fakeResponse({ url, body: HTML });
    };
    const f = createFetcher({ fetchImpl, hostDelayMs: 0 });
    const [a, b] = await Promise.all([
      f.fetchPage('https://fixture.example/dates'),
      f.fetchPage('https://fixture.example/dates'),
    ]);
    expect(calls).toBe(1);
    expect(a).toEqual(b);
  });
});
