import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { WebAPIPlatformError } from '@slack/web-api';
import { fakeKv, resetKv } from '@/slack-bot/testing/fakeKv';

const { send, CONFERENCE } = vi.hoisted(() => ({
  send: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  // Paper deadline exactly 7 days after the fake "now" below.
  CONFERENCE: {
    id: 'conf26',
    title: 'CONF',
    year: 2026,
    full_name: 'Conference',
    sub: ['ML'],
    type: 'conference',
    timezone: 'UTC',
    deadline: '2026-10-09 09:00',
  },
}));

vi.mock('@/slack-bot/lib/kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));
vi.mock('@/utils/eventData', () => ({ fetchEvents: async () => [CONFERENCE] }));
vi.mock('@/slack-bot/lib/slackClient', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  postMessage: send,
}));

import { GET } from './route';
import { subscribeChannel, getSubscribedChannels } from '@/slack-bot/lib/channelSubscriptions';
import { enableNotifications, getUserPreferences } from '@/slack-bot/lib/userPreferences';
import { storeTeamToken } from '@/slack-bot/lib/teamStorage';
import { kvKeys } from '@/slack-bot/lib/kvKeys';

const run = () =>
  GET(
    new NextRequest('http://localhost/api/slack/cron/channel-reminders', {
      headers: { authorization: 'Bearer s3cret' },
    })
  );

/** Channels posted to so far. */
const postedTo = () => send.mock.calls.map(([channel]) => channel);

const channelIds = async () => (await getSubscribedChannels()).map((c) => c.channelId).sort();

describe('channel-reminders cron', () => {
  beforeEach(async () => {
    resetKv();
    send.mockReset();
    send.mockResolvedValue(undefined);
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.stubEnv('CHANNEL_REMINDER_DAYS', '');
    vi.useFakeTimers({ now: new Date('2026-10-02T09:00:00Z'), toFake: ['Date'] });
    for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
    await subscribeChannel('C1', 'c1', 'T1');
    await subscribeChannel('C2', 'c2', 'T2');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('posts to each channel once per day even if the job runs twice', async () => {
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(200);
    expect(postedTo().sort()).toEqual(['C1', 'C2']);
  });

  it('forgets a workspace whose token was revoked, including its users, and keeps posting elsewhere', async () => {
    await subscribeChannel('C3', 'c3', 'T1');
    await storeTeamToken('T1', 'xoxb-t1');
    await enableNotifications('U1', 'T1');
    await enableNotifications('U2', 'T2');
    send.mockImplementation(async (...args: unknown[]) => {
      if (args[2] === 'T1') throw new WebAPIPlatformError({ ok: false, error: 'account_inactive' });
    });

    expect((await run()).status).toBe(200);

    expect(await channelIds()).toEqual(['C2']);
    expect(await fakeKv.get(kvKeys.team.token('T1'))).toBeNull();
    expect((await getUserPreferences('U1'))?.notificationsEnabled).toBe(false);
    expect((await getUserPreferences('U2'))?.notificationsEnabled).toBe(true);
    expect(postedTo().filter((c) => c === 'C2')).toHaveLength(1);
    expect(postedTo().filter((c) => c === 'C1' || c === 'C3')).toHaveLength(1);
  });

  it('does not purge a workspace that posts with the SLACK_BOT_TOKEN fallback', async () => {
    await enableNotifications('U2', 'T2');
    send.mockImplementation(async (...args: unknown[]) => {
      if (args[2] === 'T2') throw new WebAPIPlatformError({ ok: false, error: 'token_revoked' });
    });

    await run();

    expect(await channelIds()).toEqual(['C1', 'C2']);
    expect((await getUserPreferences('U2'))?.notificationsEnabled).toBe(true);
  });

  it('unsubscribes an archived channel only', async () => {
    send.mockImplementation(async (...args: unknown[]) => {
      if (args[0] === 'C1') throw new WebAPIPlatformError({ ok: false, error: 'is_archived' });
    });

    await run();

    expect(await channelIds()).toEqual(['C2']);
  });

  it('fails when the subscribed channels cannot be read', async () => {
    vi.spyOn(fakeKv, 'smembers').mockRejectedValueOnce(new Error('redis down'));

    expect((await run()).status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });
});
