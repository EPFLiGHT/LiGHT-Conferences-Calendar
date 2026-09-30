import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { fakeKv, resetKv } from '@/slack-bot/testing/fakeKv';
import { SIGNING_SECRET, event } from '@/slack-bot/testing/slackRequest';

const { conversationsInfo, postMessage } = vi.hoisted(() => ({
  conversationsInfo: vi.fn(),
  postMessage: vi.fn(),
}));

vi.mock('@/slack-bot/lib/kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));
vi.mock('@slack/web-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  WebClient: class {
    constructor(readonly token: string) {}
    conversations = { info: conversationsInfo };
    chat = { postMessage };
    auth = { test: async () => ({ user_id: 'UBOT' }) };
  },
}));

import { POST } from './route';
import { subscribeChannel, getSubscribedChannels } from '@/slack-bot/lib/channelSubscriptions';
import { enableNotifications, getUserPreferences } from '@/slack-bot/lib/userPreferences';
import { storeTeamMetadata, storeTeamToken } from '@/slack-bot/lib/teamStorage';
import { kvKeys } from '@/slack-bot/lib/kvKeys';

const channelIds = async () => (await getSubscribedChannels()).map((c) => c.channelId).sort();

beforeEach(async () => {
  resetKv();
  vi.stubEnv('SLACK_SIGNING_SECRET', SIGNING_SECRET);
  for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
  conversationsInfo.mockReset().mockResolvedValue({ channel: { name: 'general' } });
  postMessage.mockReset().mockResolvedValue({ ok: true });
  await storeTeamToken('T1', 'xoxb-t1');
  await storeTeamToken('T2', 'xoxb-t2');
  await subscribeChannel('C1', 'c1', 'T1');
  await subscribeChannel('C2', 'c2', 'T2');
  await enableNotifications('U1', 'T1');
  await enableNotifications('U2', 'T2');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('Slack events', () => {
  it('rejects an unsigned request without touching any data', async () => {
    const signed = event('T1', { type: 'app_uninstalled' });
    const headers = new Headers(signed.headers);
    headers.set('x-slack-signature', 'v0=forged');
    const res = await POST(new NextRequest(signed.url, { method: 'POST', headers, body: await signed.text() }));

    expect(res.status).toBe(401);
    expect(await channelIds()).toEqual(['C1', 'C2']);
  });

  it('purges the workspace on tokens_revoked', async () => {
    expect((await POST(event('T1', { type: 'tokens_revoked', tokens: { bot: ['UBOT'] } }))).status).toBe(200);
    expect(await channelIds()).toEqual(['C2']);
  });

  it('answers 500 when the purge fails, so Slack retries it', async () => {
    vi.spyOn(fakeKv, 'smembers').mockRejectedValueOnce(new Error('redis down'));
    expect((await POST(event('T1', { type: 'app_uninstalled' }))).status).toBe(500);
  });

  it('answers 500 when Redis fails while the bot joins a channel, so Slack retries it', async () => {
    vi.spyOn(fakeKv, 'get').mockRejectedValue(new Error('redis down'));
    const res = await POST(event('T1', { type: 'member_joined_channel', user: 'UBOT', channel: 'C9' }));
    expect(res.status).toBe(500);
  });

  it('subscribes a joined channel even when its name cannot be looked up', async () => {
    await storeTeamMetadata('T1', { teamName: 'T1', botUserId: 'UBOT', installedAt: '', scope: '', appId: 'A1' });
    conversationsInfo.mockRejectedValue(new Error('missing_scope'));

    const res = await POST(event('T1', { type: 'member_joined_channel', user: 'UBOT', channel: 'C9' }));

    expect(res.status).toBe(200);
    expect(await channelIds()).toEqual(['C1', 'C2', 'C9']);
  });

  it("purges the workspace and stops its users' reminders, leaving other workspaces alone", async () => {
    const res = await POST(event('T1', { type: 'app_uninstalled' }));

    expect(res.status).toBe(200);
    expect(await fakeKv.get(kvKeys.team.token('T1'))).toBeNull();
    expect((await getSubscribedChannels()).map((c) => c.channelId)).toEqual(['C2']);
    expect((await getUserPreferences('U1'))?.notificationsEnabled).toBe(false);

    expect(await fakeKv.get(kvKeys.team.token('T2'))).toBe('xoxb-t2');
    expect((await getUserPreferences('U2'))?.notificationsEnabled).toBe(true);
  });
});
