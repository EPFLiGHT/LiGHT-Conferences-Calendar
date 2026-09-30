/** What a failed Slack Web API call says about the workspace or the message target. */

export type SlackFailure = 'team_gone' | 'target_gone' | 'other';

// Not invalid_auth: a mistyped SLACK_BOT_TOKEN must not purge a workspace.
const TEAM_GONE = new Set(['account_inactive', 'token_revoked']);

// Channel codes come from chat.postMessage; the user codes cover DMs to deactivated users and bots.
const TARGET_GONE = new Set([
  'channel_not_found',
  'is_archived',
  'not_in_channel',
  'user_not_found',
  'user_disabled',
  'cannot_dm_bot',
]);

/** The API error code of an @slack/web-api platform error, e.g. `token_revoked`. */
export function slackErrorCode(error: unknown): string | undefined {
  const code = (error as { data?: { error?: unknown } } | undefined)?.data?.error;
  return typeof code === 'string' ? code : undefined;
}

export function classifySlackError(error: unknown): SlackFailure {
  const code = slackErrorCode(error);
  if (code && TEAM_GONE.has(code)) return 'team_gone';
  if (code && TARGET_GONE.has(code)) return 'target_gone';
  return 'other';
}
