/** Signed Slack requests for route tests; stub SLACK_SIGNING_SECRET with SIGNING_SECRET. */

import crypto from 'crypto';
import { NextRequest } from 'next/server';

export const SIGNING_SECRET = 'test-signing-secret';

function signed(path: string, body: string, contentType: string): NextRequest {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature =
    'v0=' + crypto.createHmac('sha256', SIGNING_SECRET).update(`v0:${timestamp}:${body}`).digest('hex');
  return new NextRequest(`http://localhost${path}`, {
    method: 'POST',
    body,
    headers: {
      'content-type': contentType,
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signature,
    },
  });
}

export function slashCommand(command: string, text = '', teamId = 'T1'): NextRequest {
  const body = new URLSearchParams({ command, text, user_id: 'U1', team_id: teamId }).toString();
  return signed('/api/slack/commands', body, 'application/x-www-form-urlencoded');
}

function interaction(payload: Record<string, unknown>): NextRequest {
  const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString();
  return signed('/api/slack/interactions', body, 'application/x-www-form-urlencoded');
}

function clickPayload(actionId: string, teamId: string, value?: string): Record<string, unknown> {
  return {
    type: 'block_actions',
    user: { id: 'U1', username: 'u1', name: 'u1', team_id: teamId },
    team: { id: teamId, domain: 'example' },
    api_app_id: 'A1',
    token: 'legacy',
    actions: [{ action_id: actionId, block_id: 'b', type: 'button', action_ts: '1', value }],
  };
}

export function buttonClick(actionId: string, teamId = 'T1', value?: string): NextRequest {
  return interaction(clickPayload(actionId, teamId, value));
}

/** A click in the App Home tab, which carries the view and no response_url. */
export function homeButtonClick(actionId: string, teamId = 'T1'): NextRequest {
  return interaction({ ...clickPayload(actionId, teamId), view: { type: 'home' } });
}

export function event(teamId: string, event: Record<string, unknown>): NextRequest {
  const body = JSON.stringify({ type: 'event_callback', team_id: teamId, api_app_id: 'A1', token: 'legacy', event });
  return signed('/api/slack/events', body, 'application/json');
}
