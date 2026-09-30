import type { NextResponse } from 'next/server';
import { withSlackMiddleware } from '@/slack-bot/lib/middleware';
import { badRequestResponse, ephemeralResponse, textResponse } from '@/slack-bot/lib/responses';
import { ConferenceFetchError } from '@/slack-bot/lib/conferences';
import { commandHandler } from '@/slack-bot/commands';
import { logger } from '@/slack-bot/lib/logger';
import type { SlackCommandPayload } from '@/types/slack-payloads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TIMEOUT_TEXT =
  '⏱️ The request timed out while fetching conference data. This usually happens when the data source is slow to respond. Please try again in a moment.';
const ERROR_TEXT =
  '❌ An error occurred processing your command. Please try again or contact support if the issue persists.';

/** Runs the command's handler; the one place a failed command turns into a reply. */
async function handleSlashCommand(payload: SlackCommandPayload, teamId?: string): Promise<NextResponse> {
  const { command, text = '', user_id: userId } = payload;
  if (!userId) return badRequestResponse('Missing user information');

  const handler = commandHandler(command);
  if (!handler) {
    return textResponse(`Unknown command: ${command}. Use \`/conf-help\` to see available commands.`);
  }

  logger.info('Slash command', { command, userId, teamId });
  try {
    return ephemeralResponse(await handler({ userId, text: text.trim(), teamId }));
  } catch (error) {
    logger.error('Slash command failed', { command, userId, teamId, error });
    return textResponse(error instanceof ConferenceFetchError && error.timedOut ? TIMEOUT_TEXT : ERROR_TEXT);
  }
}

export const POST = withSlackMiddleware<SlackCommandPayload>('form', handleSlashCommand);
