import { NextResponse } from 'next/server';
import { withSlackMiddleware, SlackRequestType } from '@/slack-bot/lib/middleware';
import { acknowledgeResponse } from '@/slack-bot/lib/responses';
import type { SlackInteractionPayload } from '@/types/slack-payloads';
import { getConferenceDetailsById } from '@/slack-bot/lib/conferenceHelpers';
import {
  buildErrorMessage,
  buildSuccessMessage,
  buildSettingsPanel,
} from '@/slack-bot/lib/messageBuilder';
import {
  enableNotifications,
  disableNotifications,
} from '@/slack-bot/lib/userPreferences';
import { logger } from '@/slack-bot/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Personal button actions reply ephemerally to avoid spamming the channel —
 * the message is only visible to the user who clicked.
 */
type ResponsePayload = Record<string, unknown> & {
  response_type?: 'ephemeral' | 'in_channel';
  replace_original?: boolean;
};

async function sendToResponseUrl(
  responseUrl: string,
  payload: ResponsePayload
): Promise<void> {
  const TIMEOUT_MS = 3000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    await fetch(responseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    logger.warn('Failed to send via response_url', {
      error: isTimeout ? 'Request timeout' : err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Reply to the interaction. Prefers response_url (works for both initial and
 * follow-up messages) and falls back to a direct JSON response.
 */
async function reply(
  responseUrl: string | undefined,
  payload: ResponsePayload
): Promise<NextResponse> {
  if (responseUrl) {
    await sendToResponseUrl(responseUrl, payload);
    return new NextResponse('', { status: 200 });
  }
  return NextResponse.json(payload);
}

async function handleBlockActions(
  payload: SlackInteractionPayload
): Promise<NextResponse> {
  const actionId = payload.actions?.[0]?.action_id;
  const actionValue = payload.actions?.[0]?.value;
  const userId = payload.user.id;
  const responseUrl = payload.response_url;

  logger.debug('Block action', { actionId, actionValue, userId });

  if (actionId?.startsWith('details_')) {
    const conferenceId = actionValue;
    if (!conferenceId) {
      return reply(responseUrl, {
        ...buildErrorMessage('Invalid conference ID'),
        response_type: 'ephemeral',
        replace_original: false,
      });
    }

    try {
      const message = await getConferenceDetailsById(conferenceId);
      return reply(responseUrl, {
        ...message,
        response_type: 'ephemeral',
        replace_original: false,
      });
    } catch (error) {
      logger.error('Failed to fetch conference details', error, { conferenceId });
      return reply(responseUrl, {
        ...buildErrorMessage('Failed to fetch conference details. Please try again.'),
        response_type: 'ephemeral',
        replace_original: false,
      });
    }
  }

  if (actionId === 'enable_notifications') {
    try {
      const prefs = await enableNotifications(userId);
      return reply(responseUrl, {
        ...buildSettingsPanel(prefs),
        response_type: 'ephemeral',
        replace_original: true,
      });
    } catch (error) {
      logger.error('Failed to enable notifications', error, { userId });
      return reply(responseUrl, {
        ...buildErrorMessage('Failed to enable notifications. Please try again.'),
        response_type: 'ephemeral',
        replace_original: false,
      });
    }
  }

  if (actionId === 'disable_notifications') {
    try {
      const prefs = await disableNotifications(userId);
      return reply(responseUrl, {
        ...buildSettingsPanel(prefs),
        response_type: 'ephemeral',
        replace_original: true,
      });
    } catch (error) {
      logger.error('Failed to disable notifications', error, { userId });
      return reply(responseUrl, {
        ...buildErrorMessage('Failed to disable notifications. Please try again.'),
        response_type: 'ephemeral',
        replace_original: false,
      });
    }
  }

  if (actionId?.startsWith('calendar_')) {
    const conferenceId = actionValue;
    const baseUrl = process.env.APP_URL
      || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null)
      || 'http://localhost:3000';
    const calendarUrl = `${baseUrl}/api/calendar/${conferenceId}`;

    return reply(responseUrl, {
      ...buildSuccessMessage(
        `To add this conference to your calendar, visit:\n${calendarUrl}\n\nThis will download an ICS file that you can import into your calendar app.`
      ),
      response_type: 'ephemeral',
      replace_original: false,
    });
  }

  if (actionId === 'edit_subjects') {
    return reply(responseUrl, {
      ...buildErrorMessage(
        'Subject editing is coming soon! For now, use the web interface to manage your subject preferences.'
      ),
      response_type: 'ephemeral',
      replace_original: false,
    });
  }

  return acknowledgeResponse();
}

async function handleViewSubmission(
  payload: SlackInteractionPayload
): Promise<NextResponse> {
  logger.debug('View submission', { callbackId: payload.view?.callback_id });
  return acknowledgeResponse();
}

async function handleViewClosed(
  payload: SlackInteractionPayload
): Promise<NextResponse> {
  logger.debug('View closed', { callbackId: payload.view?.callback_id });
  return acknowledgeResponse();
}

async function handleInteraction(
  payload: SlackInteractionPayload,
  _request: unknown,
  teamId?: string
): Promise<NextResponse> {
  logger.debug('Interaction received', { type: payload.type, teamId });
  switch (payload.type) {
    case 'block_actions':
      return handleBlockActions(payload);
    case 'view_submission':
      return handleViewSubmission(payload);
    case 'view_closed':
      return handleViewClosed(payload);
    case 'shortcut':
      logger.debug('Shortcut triggered');
      return acknowledgeResponse();
    default:
      logger.debug('Unknown interaction type', { type: payload.type });
      return acknowledgeResponse();
  }
}

export const POST = withSlackMiddleware<SlackInteractionPayload>({
  requestType: SlackRequestType.FORM_URLENCODED,
  handler: handleInteraction,
});
