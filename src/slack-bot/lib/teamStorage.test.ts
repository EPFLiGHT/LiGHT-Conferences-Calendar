import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory stand-in that serializes like @upstash/redis: non-strings are
// JSON-encoded on write, and reads JSON-decode whatever text is stored.
const { store } = vi.hoisted(() => ({ store: new Map<string, string>() }));

vi.mock('./kv', () => ({
  kv: {
    async set(key: string, value: unknown) {
      store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
      return 'OK';
    },
    async get(key: string) {
      const raw = store.get(key);
      if (raw === undefined) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
  },
}));

import { storeTeamMetadata, getTeamMetadata, removeTeamData } from './teamStorage';
import { kvKeys } from './kvKeys';

const META = {
  teamName: 'LiGHT',
  botUserId: 'U123',
  installedAt: '2026-09-28T00:00:00.000Z',
  scope: 'chat:write',
  appId: 'A123',
};

describe('team metadata storage', () => {
  beforeEach(() => {
    store.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('round-trips metadata', async () => {
    await storeTeamMetadata('T1', META);
    expect(await getTeamMetadata('T1')).toEqual(META);
  });

  it('reads entries stored as JSON strings by older versions', async () => {
    store.set(kvKeys.team.metadata('T1'), JSON.stringify(META));
    expect(await getTeamMetadata('T1')).toEqual(META);
  });

  it('returns null for unknown teams and after removal', async () => {
    expect(await getTeamMetadata('T404')).toBeNull();
    await storeTeamMetadata('T1', META);
    await removeTeamData('T1');
    expect(await getTeamMetadata('T1')).toBeNull();
  });
});
