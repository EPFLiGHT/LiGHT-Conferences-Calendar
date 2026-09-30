import { NextResponse } from 'next/server';
import { storeTeamToken, storeTeamMetadata } from '@/slack-bot/lib/teamStorage';
import { appUrl } from '@/slack-bot/lib/appUrl';
import { logger } from '@/slack-bot/lib/logger';
import { ROUTES, SITE_URL } from '@/constants/routes';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const failure = (error: string, message: string, status: number) =>
  NextResponse.json({ error, message }, { status });

/** Slack redirects here after authorization: exchange the code for a bot token and store it. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code');

  if (params.get('error')) {
    return failure('Installation cancelled', 'You denied the installation request.', 400);
  }
  if (!code) {
    return failure('No authorization code', 'No authorization code received.', 400);
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return failure('Configuration error', 'Slack OAuth credentials not configured.', 500);
  }

  try {
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl()}/api/slack/oauth/callback`,
      }),
    });
    const data = await tokenResponse.json();

    if (!data.ok) {
      logger.error('OAuth token exchange failed', { slackError: data.error });
      return failure('Installation failed', data.error || 'Unknown error', 400);
    }

    const { id: teamId, name: teamName } = data.team;
    await storeTeamToken(teamId, data.access_token);
    await storeTeamMetadata(teamId, {
      teamName,
      botUserId: data.bot_user_id,
      installedAt: new Date().toISOString(),
      scope: data.scope,
      appId: data.app_id,
    });
    logger.info('Bot installed', { teamId, teamName });

    const successUrl = new URL(ROUTES.slackSuccess, SITE_URL);
    successUrl.searchParams.set('team', teamName);
    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    logger.error('OAuth callback failed', { error });
    return failure('Installation failed', error instanceof Error ? error.message : 'Unknown error', 500);
  }
}
