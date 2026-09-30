import { describe, it, expect, vi } from 'vitest';

const { EVENTS } = vi.hoisted(() => ({ EVENTS: [{ id: 'conf26' }] }));

// Like the real lazy client when no Redis credentials are set: any method access throws.
vi.mock('@/slack-bot/lib/kv', () => ({
  kv: new Proxy({}, { get: () => { throw new Error('Missing Redis credentials'); } }),
}));
vi.mock('@/utils/eventData', () => ({ fetchEvents: async () => EVENTS }));

import { getConferences } from './conferences';

describe('getConferences', () => {
  it('serves the data files when the cache is unavailable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await getConferences()).toEqual(EVENTS);
  });
});
