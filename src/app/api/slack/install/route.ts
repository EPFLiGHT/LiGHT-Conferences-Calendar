import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * OAuth Installation Endpoint
 *
 * This endpoint initiates the Slack OAuth flow by redirecting users to Slack's
 * authorization page. Users will be prompted to install the bot in their workspace.
 */
export async function GET(request: Request) {
  const clientId = process.env.SLACK_CLIENT_ID;
  const appUrl = process.env.APP_URL || 'https://conferences-calendar.vercel.app';
  const redirectUri = `${appUrl}/api/slack/oauth/callback`;

  if (!clientId) {
    return NextResponse.json(
      { error: 'Slack client ID not configured' },
      { status: 500 }
    );
  }

  // Scopes required for the bot. Keep in sync with the public install link.
  const scopes = [
    'channels:read',     // resolve public channel info on member_joined_channel
    'chat:write',        // post to channels we're in
    'chat:write.public', // post to channels we're NOT in (e.g. broadcasts)
    'commands',          // slash commands
    'groups:read',       // resolve private channel info on member_joined_channel
    'mpim:read',         // multi-person DMs
    'users:read',
    'users:read.email',
  ].join(',');

  // Build the Slack OAuth authorization URL
  const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackAuthUrl.searchParams.set('client_id', clientId);
  slackAuthUrl.searchParams.set('scope', scopes);
  slackAuthUrl.searchParams.set('redirect_uri', redirectUri);

  // Optional: Add state parameter for CSRF protection
  const url = new URL(request.url);
  const state = url.searchParams.get('state');
  if (state) {
    slackAuthUrl.searchParams.set('state', state);
  }

  // Redirect to Slack's authorization page
  return NextResponse.redirect(slackAuthUrl.toString());
}
