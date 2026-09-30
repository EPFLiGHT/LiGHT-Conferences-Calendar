import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetKv } from '@/slack-bot/testing/fakeKv';
import { SIGNING_SECRET, buttonClick } from '@/slack-bot/testing/slackRequest';

vi.mock('@/slack-bot/lib/kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));

import { POST } from './route';
import { getUserPreferences } from '@/slack-bot/lib/userPreferences';

describe('interactions', () => {
  beforeEach(() => {
    resetKv();
    vi.stubEnv('SLACK_SIGNING_SECRET', SIGNING_SECRET);
    vi.stubEnv('APP_URL', '');
    vi.spyOn(console, 'log').mockImplementation(() => {});
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

  it('acknowledges link-button clicks without replying', async () => {
    const res = await POST(buttonClick('ics_pets26'));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
