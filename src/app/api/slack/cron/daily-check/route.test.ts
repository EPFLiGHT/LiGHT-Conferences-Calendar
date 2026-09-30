import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { WebAPIPlatformError } from '@slack/web-api';
import { fakeKv, resetKv } from '@/slack-bot/testing/fakeKv';

const { send, CONFERENCES } = vi.hoisted(() => ({
  send: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}),
  // A paper deadline and an event start, both exactly 7 days after the fake "now" below.
  CONFERENCES: [
    {
      id: 'conf26',
      title: 'CONF',
      year: 2026,
      full_name: 'Conference',
      sub: ['ML'],
      type: 'conference',
      timezone: 'UTC',
      deadline: '2026-10-09 09:00',
    },
    {
      id: 'summit26',
      title: 'SUMMIT',
      year: 2026,
      full_name: 'Summit',
      sub: ['Global Health'],
      type: 'summit',
      timezone: 'UTC',
      start: '2026-10-09',
      end: '2026-10-10',
    },
  ],
}));

vi.mock('@/slack-bot/lib/kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));
vi.mock('@/utils/eventData', () => ({ fetchEvents: async () => CONFERENCES }));
vi.mock('@/slack-bot/lib/slackClient', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  postMessage: send,
}));

import { GET } from './route';
import { enableNotifications, getUserPreferences } from '@/slack-bot/lib/userPreferences';
import { storeTeamToken } from '@/slack-bot/lib/teamStorage';
import { kvKeys } from '@/slack-bot/lib/kvKeys';

const run = () =>
  GET(
    new NextRequest('http://localhost/api/slack/cron/daily-check', {
      headers: { authorization: 'Bearer s3cret' },
    })
  );

/** Messages sent so far, as { channel, blocks, teamId }. */
const sent = () =>
  send.mock.calls.map(([channel, message, teamId]) => ({
    channel,
    blocks: (message as { blocks: any[] }).blocks,
    teamId,
  }));

const slackError = (code: string) => new WebAPIPlatformError({ ok: false, error: code });

describe('daily-check cron', () => {
  beforeEach(async () => {
    resetKv();
    send.mockReset();
    send.mockResolvedValue(undefined);
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.useFakeTimers({ now: new Date('2026-10-02T09:00:00Z'), toFake: ['Date'] });
    for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
    await enableNotifications('U1', 'T1');
    await enableNotifications('U2', 'T2');
    await storeTeamToken('T1', 'xoxb-t1');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('sends each user one DM per day even if the job runs twice', async () => {
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(200);
    expect(sent().map((m) => m.channel).sort()).toEqual(['U1', 'U2']);
  });

  it('sends deadlines and event starts as one digest with a single header', async () => {
    await run();

    const { blocks } = sent()[0];
    expect(blocks.filter((b) => b.type === 'header')).toHaveLength(1);
    const text = JSON.stringify(blocks);
    expect(text).toContain('CONF 2026');
    expect(text).toContain('SUMMIT 2026');
  });

  it('stops DMing a workspace whose token was revoked, without touching other workspaces', async () => {
    send.mockImplementation(async (...args: unknown[]) => {
      if (args[2] === 'T1') throw slackError('token_revoked');
    });

    expect((await run()).status).toBe(200);
    await run();

    expect(sent().filter((m) => m.channel === 'U1')).toHaveLength(1);
    expect((await getUserPreferences('U1'))?.notificationsEnabled).toBe(false);
    expect(await fakeKv.get(kvKeys.team.token('T1'))).toBeNull();
    expect((await getUserPreferences('U2'))?.notificationsEnabled).toBe(true);
    expect(sent().filter((m) => m.channel === 'U2')).toHaveLength(1);
  });

  it('stops DMing a user Slack cannot reach, keeping their workspace', async () => {
    send.mockImplementation(async (...args: unknown[]) => {
      if (args[0] === 'U1') throw slackError('channel_not_found');
    });

    await run();
    await run();

    expect(sent().filter((m) => m.channel === 'U1')).toHaveLength(1);
    expect((await getUserPreferences('U1'))?.notificationsEnabled).toBe(false);
    expect(await fakeKv.get(kvKeys.team.token('T1'))).toBe('xoxb-t1');
  });

  it('fails when the subscribers cannot be read', async () => {
    vi.spyOn(fakeKv, 'smembers').mockRejectedValueOnce(new Error('redis down'));

    expect((await run()).status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });
});
