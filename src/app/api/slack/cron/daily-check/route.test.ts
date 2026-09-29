import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const { store, sendDM, CONFERENCE, USER } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  sendDM: vi.fn(async () => {}),
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
  USER: {
    slackUserId: 'U1',
    teamId: 'T1',
    notificationsEnabled: true,
    timezone: 'UTC',
    reminderDays: [30, 7, 3],
    subjects: [],
  },
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
vi.mock('@/slack-bot/lib/userPreferences', () => ({ getAllUsersWithNotifications: async () => [USER] }));
vi.mock('@/slack-bot/lib/slackClient', () => ({ sendDM }));

import { GET } from './route';

const run = () =>
  GET(
    new NextRequest('http://localhost/api/slack/cron/daily-check', {
      headers: { authorization: 'Bearer s3cret' },
    })
  );

describe('daily-check cron', () => {
  beforeEach(() => {
    store.clear();
    sendDM.mockClear();
    vi.stubEnv('CRON_SECRET', 's3cret');
    vi.useFakeTimers({ now: new Date('2026-10-02T09:00:00Z'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('sends each user one DM per day even if the job runs twice', async () => {
    expect((await run()).status).toBe(200);
    expect((await run()).status).toBe(200);
    expect(sendDM).toHaveBeenCalledOnce();
  });
});
