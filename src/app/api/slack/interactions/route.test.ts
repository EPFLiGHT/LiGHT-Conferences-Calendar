import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { NextRequest } from 'next/server';

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('@/slack-bot/lib/kv', () => ({
  kv: {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async set(key: string, value: unknown) {
      store.set(key, structuredClone(value));
      return 'OK';
    },
    async sadd() {
      return 1;
    },
  },
}));

import { POST } from './route';
import { getUserPreferences } from '@/slack-bot/lib/userPreferences';

const SIGNING_SECRET = 'test-signing-secret';

function buttonClick(actionId: string, teamId: string): NextRequest {
  const payload = {
    type: 'block_actions',
    user: { id: 'U1', username: 'u1', name: 'u1', team_id: teamId },
    team: { id: teamId, domain: 'example' },
    api_app_id: 'A1',
    token: 'legacy',
    actions: [{ action_id: actionId, block_id: 'b', type: 'button', action_ts: '1' }],
  };
  const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature =
    'v0=' + crypto.createHmac('sha256', SIGNING_SECRET).update(`v0:${timestamp}:${body}`).digest('hex');

  return new NextRequest('http://localhost/api/slack/interactions', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    },
  });
}

describe('settings panel notification buttons', () => {
  beforeEach(() => {
    store.clear();
    vi.stubEnv('SLACK_SIGNING_SECRET', SIGNING_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('records the workspace when enabling, so DMs use that workspace token', async () => {
    const res = await POST(buttonClick('enable_notifications', 'T2'));

    expect(res.status).toBe(200);
    const prefs = await getUserPreferences('U1');
    expect(prefs?.notificationsEnabled).toBe(true);
    expect(prefs?.teamId).toBe('T2');
  });
});
