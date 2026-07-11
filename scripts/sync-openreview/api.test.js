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
});
