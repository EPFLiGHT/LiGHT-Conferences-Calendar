import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeKv, resetKv } from '@/slack-bot/testing/fakeKv';
import { SIGNING_SECRET, buttonClick, homeButtonClick } from '@/slack-bot/testing/slackRequest';

const { viewsPublish } = vi.hoisted(() => ({ viewsPublish: vi.fn() }));

vi.mock('@/slack-bot/lib/kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));
vi.mock('@slack/web-api', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  WebClient: class {
    constructor(readonly token: string) {}
    views = { publish: viewsPublish };
  },
}));

import { POST } from './route';
import { getUserPreferences } from '@/slack-bot/lib/userPreferences';
import { storeTeamToken } from '@/slack-bot/lib/teamStorage';
import { kvKeys } from '@/slack-bot/lib/kvKeys';
import { conference } from '@/slack-bot/testing/fixtures';

describe('interactions', () => {
  beforeEach(async () => {
    resetKv();
    vi.stubEnv('SLACK_SIGNING_SECRET', SIGNING_SECRET);
    vi.stubEnv('APP_URL', '');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    viewsPublish.mockReset().mockResolvedValue({ ok: true });
    await storeTeamToken('T1', 'xoxb-t1');
    await fakeKv.set(kvKeys.cache.conferences, [conference({ deadline: '2099-01-15 23:59' })]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('records the workspace when enabling, so DMs use that workspace token', async () => {
    const res = await POST(buttonClick('enable_notifications', 'T2'));

    expect(res.status).toBe(200);
    const prefs = await getUserPreferences('U1');
    expect(prefs?.notificationsEnabled).toBe(true);
    expect(prefs?.teamId).toBe('T2');
  });

  it('answers Add to Calendar buttons on older reminders with the production download link', async () => {
    const res = await POST(buttonClick('calendar_pets26', 'T1', 'pets26'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.response_type).toBe('ephemeral');
    expect(body.text).toContain('https://conferences-calendar.vercel.app/api/calendar/pets26');
  });

  it('turns reminders on from the Home tab and republishes it with the new state', async () => {
    const res = await POST(homeButtonClick('enable_notifications'));

    expect(await res.json()).toEqual({ ok: true });
    expect((await getUserPreferences('U1'))?.notificationsEnabled).toBe(true);
    expect(viewsPublish).toHaveBeenCalledOnce();
    const { user_id, view } = viewsPublish.mock.calls[0][0];
    expect(user_id).toBe('U1');
    expect(JSON.stringify(view.blocks)).toContain('disable_notifications');
  });

  it('acknowledges Home tab link clicks without republishing', async () => {
    const res = await POST(homeButtonClick('home_website'));

    expect(await res.json()).toEqual({ ok: true });
    expect(viewsPublish).not.toHaveBeenCalled();
  });

  it('acknowledges link-button clicks without replying', async () => {
    const res = await POST(buttonClick('ics_pets26'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
