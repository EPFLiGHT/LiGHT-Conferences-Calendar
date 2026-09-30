import { NextResponse } from 'next/server';
import { appUrl } from '@/slack-bot/lib/appUrl';
import { errorResponse } from '@/slack-bot/lib/responses';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Keep in sync with the scopes listed in SLACK_BOT_README.md and OAUTH_SETUP.md.
const SCOPES = [
  'channels:read', // resolve public channel info on member_joined_channel
  'chat:write', // post to channels we're in
  'chat:write.public', // post to channels we're NOT in (e.g. broadcasts)
  'commands', // slash commands
  'groups:read', // resolve private channel info on member_joined_channel
  'mpim:read', // multi-person DMs
  'users:read',
  'users:read.email',
];

/** Starts the "Add to Slack" OAuth flow by redirecting to Slack's authorization page. */
export async function GET(request: Request) {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) return errorResponse('Slack client ID not configured');

  const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackAuthUrl.searchParams.set('client_id', clientId);
  slackAuthUrl.searchParams.set('scope', SCOPES.join(','));
  slackAuthUrl.searchParams.set('redirect_uri', `${appUrl()}/api/slack/oauth/callback`);

  const state = new URL(request.url).searchParams.get('state');
  if (state) slackAuthUrl.searchParams.set('state', state);

  return NextResponse.redirect(slackAuthUrl.toString());
}
