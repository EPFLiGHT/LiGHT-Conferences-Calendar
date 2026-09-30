import { describe, it, expect } from 'vitest';
import { urlNeedsUpdate, nextHome, followSource } from './venue-config.js';
import { fakeFetcher } from './test-helpers.js';

describe('nextHome', () => {
  const fetcher = fakeFetcher({ 'https://hc.example/2027/': 'HealthConf 2027' });

  it('moves a year-specific home to the year the deadlines were found for, once it loads', async () => {
    expect(await nextHome({ home: 'https://hc.example/2026/' }, 'https://hc.example/2027/dates', fetcher)).toBe('https://hc.example/2027/');
  });

  it('keeps an evergreen home, or one whose new-year page does not load', async () => {
    expect(await nextHome({ home: 'https://hc.example/' }, 'https://hc.example/2027/dates', fetcher)).toBeNull();
    expect(await nextHome({ home: 'https://hc.example/2025/' }, 'https://hc.example/2026/dates', fetcher)).toBeNull();
  });
});

describe('urlNeedsUpdate', () => {
  it('treats a malformed configured URL as needing the update instead of throwing', () => {
    expect(urlNeedsUpdate('htps//typo', 'https://hc.example/dates')).toBe(true);
    expect(urlNeedsUpdate(undefined, 'https://hc.example/dates')).toBe(true);
  });
  it('compares normalized forms', () => {
    expect(urlNeedsUpdate('https://HC.example/dates/#section', 'https://hc.example/dates')).toBe(false);
    expect(urlNeedsUpdate('https://hc.example/old', 'https://hc.example/dates')).toBe(true);
  });
});

describe('followSource', () => {
  const fetcher = fakeFetcher({ 'https://hc.example/2027/': 'HealthConf 2027' });

  it('points the config at the page the deadlines came from and moves the home along', async () => {
    const cfg = { url: 'https://hc.example/2026/dates', home: 'https://hc.example/2026/' };
    const flags = await followSource('HealthConf', cfg, 'https://hc.example/2027/dates', fetcher);
    expect(cfg).toEqual({ url: 'https://hc.example/2027/dates', home: 'https://hc.example/2027/' });
    expect(flags).toEqual([
      'HealthConf: deadlines found at https://hc.example/2027/dates, not the configured URL; venues.json updated',
      'HealthConf: venue home moved to https://hc.example/2027/',
    ]);
  });

  it('leaves a config that already points there alone', async () => {
    const cfg = { url: 'https://hc.example/2027/dates/', home: 'https://hc.example/2026/' };
    expect(await followSource('HealthConf', cfg, 'https://hc.example/2027/dates', fetcher)).toEqual([]);
    expect(cfg.home).toBe('https://hc.example/2026/');
  });
});
