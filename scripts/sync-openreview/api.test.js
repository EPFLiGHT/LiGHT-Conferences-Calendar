import { describe, it, expect } from 'vitest';
import { createApi } from './api.js';

function fakeFetch(routes) {
  return async (url) => {
    for (const [substr, body] of Object.entries(routes)) {
      if (url.includes(substr)) {
        return { ok: true, json: async () => body };
      }
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
}

describe('createApi', () => {
  it('returns venue group content and null for missing groups', async () => {
    const api = createApi(
      fakeFetch({ 'ICML.cc%2F2026%2FConference': { groups: [{ content: { location: { value: 'Seoul' } } }] } }),
    );
    const content = await api.getVenueGroup('ICML.cc', 2026);
    expect(content.location.value).toBe('Seoul');
    expect(await api.getVenueGroup('ICML.cc', 2031)).toBeNull();
  });

  it('reads duedate from the expired submission invitation', async () => {
    const api = createApi(
      fakeFetch({ 'expired=true': { invitations: [{ duedate: 1770000000000 }] } }),
    );
    expect(await api.getSubmissionDuedate('X/-/Submission')).toBe(1770000000000);
  });

  it('waits out a rate limit and retries instead of reading it as a missing group', async () => {
    const waits = [];
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 429, headers: new Headers({ 'ratelimit-reset': '7' }) };
      return { ok: true, status: 200, json: async () => ({ groups: [{ content: { location: { value: 'Porto' } } }] }) };
    };
    const api = createApi(fetchFn, { sleep: async (ms) => { waits.push(ms); } });
    const content = await api.getVenueGroup('MIDL.io', 2027);
    expect(content.location.value).toBe('Porto');
    expect(waits).toEqual([8000]);
  });

  it('throws on other http errors, so the venue is reported rather than silently skipped', async () => {
    const api = createApi(async () => ({ ok: false, status: 500 }), { sleep: async () => {} });
    await expect(api.getVenueGroup('ICML.cc', 2026)).rejects.toThrow('http 500');
  });

  it('gives up after repeated rate limits', async () => {
    const api = createApi(async () => ({ ok: false, status: 429, headers: new Headers() }), { sleep: async () => {} });
    await expect(api.getVenueGroup('ICML.cc', 2026)).rejects.toThrow('http 429');
  });
});
