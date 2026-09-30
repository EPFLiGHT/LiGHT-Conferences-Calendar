import type { NextResponse } from 'next/server';
import { withSlackMiddleware } from '@/slack-bot/lib/middleware';
import { acknowledgeResponse, ephemeralReply, successResponse, type EphemeralReply } from '@/slack-bot/lib/responses';
import { buildErrorMessage, buildSuccessMessage, buildSettingsPanel } from '@/slack-bot/lib/messages/replies';
import { enableNotifications, disableNotifications } from '@/slack-bot/lib/userPreferences';
import { appUrl } from '@/slack-bot/lib/appUrl';
import { logger } from '@/slack-bot/lib/logger';
import type { SlackInteractionPayload } from '@/types/slack-payloads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const RESPONSE_URL_TIMEOUT_MS = 3000;

// Reminders already posted carry action buttons `calendar_<id>`, which still need a reply with the link.
const LEGACY_CALENDAR_PREFIX = 'calendar_';

/** The reply to a button click, or null when the click needs only an acknowledgement (link buttons). */
async function replyToAction(actionId: string, userId: string, teamId?: string): Promise<EphemeralReply | null> {
  if (actionId === 'enable_notifications') {
    return ephemeralReply(buildSettingsPanel(await enableNotifications(userId, teamId)), true);
  }
  if (actionId === 'disable_notifications') {
    return ephemeralReply(buildSettingsPanel(await disableNotifications(userId)), true);
  }
  if (actionId.startsWith(LEGACY_CALENDAR_PREFIX)) {
    const calendarUrl = `${appUrl()}/api/calendar/${actionId.slice(LEGACY_CALENDAR_PREFIX.length)}`;
    return ephemeralReply(
      buildSuccessMessage(
        `To add this conference to your calendar, visit:\n${calendarUrl}\n\nThis will download an ICS file that you can import into your calendar app.`
      ),
      false
    );
  }
  return null;
}

async function handleInteraction(payload: SlackInteractionPayload, teamId?: string): Promise<NextResponse> {
  const actionId = payload.actions?.[0]?.action_id;
  if (payload.type !== 'block_actions' || !actionId) return acknowledgeResponse();

  const userId = payload.user.id;
  let reply: EphemeralReply | null;
  try {
    reply = await replyToAction(actionId, userId, teamId);
  } catch (error) {
    logger.error('Button action failed', { actionId, userId, teamId, error });
    reply = ephemeralReply(buildErrorMessage('Something went wrong. Please try again.'), false);
  }
  if (!reply) return acknowledgeResponse();

  if (!payload.response_url) return successResponse(reply);
  try {
    await fetch(payload.response_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reply),
      signal: AbortSignal.timeout(RESPONSE_URL_TIMEOUT_MS),
    });
  } catch (error) {
    logger.warn('Reply via response_url failed', { actionId, error });
  }
  return acknowledgeResponse();
}

export const POST = withSlackMiddleware<SlackInteractionPayload>('form', handleInteraction);
