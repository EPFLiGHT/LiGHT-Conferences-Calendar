import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeKv, resetKv } from '@/slack-bot/testing/fakeKv';

vi.mock('./kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));

import { getSubscribedChannels } from './channelSubscriptions';
import { kvKeys } from './kvKeys';

describe('channel subscriptions', () => {
  beforeEach(() => {
    resetKv();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads records that still carry retired fields, keeping only the current ones', async () => {
    await fakeKv.set(kvKeys.channel.record('C1'), {
      channelId: 'C1',
      channelName: 'general',
      teamId: 'T1',
      isActive: true,
      addedBy: 'U1',
      subscribedAt: '2026-01-01T00:00:00.000Z',
      lastPostedAt: '2026-09-01T09:00:00.000Z',
    });
    await fakeKv.sadd(kvKeys.idx.channel, 'C1', 'C404');

    expect(await getSubscribedChannels()).toEqual([
      {
        channelId: 'C1',
        channelName: 'general',
        teamId: 'T1',
        addedBy: 'U1',
        subscribedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
  });
});
