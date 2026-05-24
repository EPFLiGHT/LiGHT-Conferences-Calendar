import { NextResponse } from 'next/server';
import { withSlackMiddleware, SlackRequestType } from '@/slack-bot/lib/middleware';
import { textResponse, badRequestResponse } from '@/slack-bot/lib/responses';
import type { SlackCommandPayload } from '@/types/slack-payloads';
import { handleHelp } from '@/slack-bot/commands/user/help';
import { handleUpcoming } from '@/slack-bot/commands/user/upcoming';
import { handleSearch } from '@/slack-bot/commands/user/search';
import { handleSubscribe } from '@/slack-bot/commands/user/subscribe';
import { handleUnsubscribe } from '@/slack-bot/commands/user/unsubscribe';
import { handleSettings } from '@/slack-bot/commands/user/settings';
import { handleSubject } from '@/slack-bot/commands/user/subject';
import { handleInfo } from '@/slack-bot/commands/user/info';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Command router - maps slash commands to their handlers
 */
const commandHandlers: Record<
  string,
  (userId: string, text: string, teamId?: string) => Promise<unknown>
> = {
  '/conf-help': (userId) => handleHelp(userId),
  '/conf-upcoming': (userId) => handleUpcoming(userId),
  '/conf-search': (userId, text) => handleSearch(userId, text),
  '/conf-subscribe': (userId, _text, teamId) => handleSubscribe(userId, teamId),
  '/conf-unsubscribe': (userId) => handleUnsubscribe(userId),
  '/conf-settings': (userId) => handleSettings(userId),
  '/conf-subject': (userId, text) => handleSubject(userId, text),
  '/conf-info': (userId, text) => handleInfo(userId, text),
};

/**
 * POST handler for Slack slash commands
 */
async function handleSlashCommand(
  payload: SlackCommandPayload,
  _request: unknown,
  teamId?: string
): Promise<NextResponse> {
  const { command, text = '', user_id: userId } = payload;

  // Log team context for debugging
  if (teamId) {
    console.log(`[Commands] Request from team: ${teamId}`);
  }

  if (!userId) {
    return badRequestResponse('Missing user information');
  }

  const handler = commandHandlers[command];

  if (!handler) {
    return textResponse(
      `Unknown command: ${command}. Use \`/conf-help\` to see available commands.`,
      'ephemeral'
    );
  }

  try {
    const result = await handler(userId, text, teamId);
    return NextResponse.json(result);
  } catch (error) {
    console.error(`Error handling command ${command}:`, error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('Request timeout');

    if (isTimeout) {
      return textResponse(
        '⏱️ The request timed out while fetching conference data. This usually happens when the data source is slow to respond. Please try again in a moment.',
        'ephemeral'
      );
    }

    return textResponse(
      '❌ An error occurred processing your command. Please try again or contact support if the issue persists.',
      'ephemeral'
    );
  }
}

export const POST = withSlackMiddleware<SlackCommandPayload>({
  requestType: SlackRequestType.FORM_URLENCODED,
  handler: handleSlashCommand,
});
