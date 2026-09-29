import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { store, postToChannel, CONFERENCE, CHANNELS } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  postToChannel: vi.fn<(channelId: string) => Promise<void>>(async () => {}),
  // Paper deadline exactly 7 days after the fake "now" below.
  CONFERENCE: {
    id: 'conf26',
    title: 'CONF',
    year: 2026,
    full_name: 'Conference',
    sub: 'ML',
    type: 'conference',
    timezone: 'UTC',
    deadline: '2026-10-09 09:00',
  },
  CHANNELS: ['C1', 'C2'].map((channelId) => ({
    channelId,
    channelName: channelId.toLowerCase(),
    teamId: 'T1',
    isActive: true,
    subscribedAt: '2026-01-01T00:00:00.000Z',
    lastPostedAt: null,
  })),
}));

vi.mock('@/slack-bot/lib/kv', () => ({
  kv: {
    async set(key: string, value: unknown, opts?: { nx?: boolean }) {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
  },
}));
vi.mock('@/slack-bot/utils/conferenceCache', () => ({ getConferences: async () => [CONFERENCE] }));
vi.mock('@/slack-bot/lib/channelSubscriptions', () => ({
  getAllActiveChannels: async () => CHANNELS,
  updateChannelLastPosted: async () => {},
  unsubscribeChannel: async () => {},
  unsubscribeTeamChannels: async () => 0,
}));
vi.mock('@/slack-bot/lib/teamStorage', () => ({ removeTeamData: async () => {} }));
vi.mock('@/slack-bot/lib/slackClient', () => ({ postToChannel, clearTeamClient: () => {} }));

import { GET } from './route';

const run = () =>
  GET(
    new NextRequest('http://localhost/api/slack/cron/channel-reminders', {
      headers: { authorization: 'Bearer s3cret' },
    })
  );

describe('channel-reminders cron', () => {
  beforeEach(() => {
    store.clear();
    postToChannel.mockClear();
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('CHANNEL_REMINDER_DAYS', '');
    vi.useFakeTimers({ now: new Date('2026-10-02T09:00:00Z'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('posts to each channel once per day even if the job runs twice', async () => {
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(200);
    expect(postToChannel.mock.calls.map((c) => c[0])).toEqual(['C1', 'C2']);
  });
});
