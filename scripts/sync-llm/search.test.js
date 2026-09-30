import { describe, it, expect } from 'vitest';
import { searchWeb } from './search.js';
import { fakeResponse } from './test-helpers.js';

describe('searchWeb', () => {
  it('parses DuckDuckGo result links', async () => {
    const ddg = `
      <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Famia.org%2F2026%2Fcfp&amp;rut=x">AMIA 2026 CFP</a>
      <a rel="nofollow" class="result__a" href="https://example.org/direct">Direct result</a>`;
    const fetchImpl = async (url) => fakeResponse({ url, body: ddg });
    const results = await searchWeb('AMIA 2026 call for participation', { fetchImpl });
    expect(results[0]).toEqual({ title: 'AMIA 2026 CFP', url: 'https://amia.org/2026/cfp' });
    expect(results[1].url).toBe('https://example.org/direct');
  });

  it('returns [] on failure', async () => {
    const fetchImpl = async () => { throw new Error('offline'); };
    expect(await searchWeb('anything', { fetchImpl })).toEqual([]);
  });
});
