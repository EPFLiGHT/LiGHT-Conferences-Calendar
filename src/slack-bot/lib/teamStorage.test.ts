import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fakeKv, resetKv } from '@/slack-bot/testing/fakeKv';

vi.mock('./kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));

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
    resetKv();
  });

  it('round-trips metadata', async () => {
    await storeTeamMetadata('T1', META);
    expect(await getTeamMetadata('T1')).toEqual(META);
  });

  it('reads entries stored as JSON strings by older versions', async () => {
    await fakeKv.set(kvKeys.team.metadata('T1'), JSON.stringify(META));
    expect(await getTeamMetadata('T1')).toEqual(META);
  });

  it('returns null for unknown teams and after removal', async () => {
    expect(await getTeamMetadata('T404')).toBeNull();
    await storeTeamMetadata('T1', META);
    await removeTeamData('T1');
    expect(await getTeamMetadata('T1')).toBeNull();
  });
});
