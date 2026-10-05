import type { NextResponse } from 'next/server';
import { withSlackMiddleware } from '@/slack-bot/lib/middleware';
import { acknowledgeResponse, successResponse } from '@/slack-bot/lib/responses';
import { subscribeChannel, unsubscribeChannel } from '@/slack-bot/lib/channelSubscriptions';
import { getSlackClient, isBotUser } from '@/slack-bot/lib/slackClient';
import { purgeTeam } from '@/slack-bot/lib/purgeTeam';
import { publishHome } from '@/slack-bot/lib/appHome';
import { section } from '@/slack-bot/lib/messages/blocks';
import { logger } from '@/slack-bot/lib/logger';
import type {
  SlackEventPayload,
  AppHomeOpenedEvent,
  MemberJoinedChannelEvent,
  MemberLeftChannelEvent,
} from '@/types/slack-payloads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function handleSlackEvent(payload: SlackEventPayload, teamId?: string): Promise<NextResponse> {
  // Slack sends this once when the Events API URL is configured
  if (payload.type === 'url_verification') {
    return successResponse({ challenge: payload.challenge });
  }

  const event = payload.event;
  if (payload.type !== 'event_callback' || !event || !teamId) return acknowledgeResponse();
  logger.info('Received event', { type: event.type, teamId });

  switch (event.type) {
    case 'member_joined_channel': {
      const joined = event as MemberJoinedChannelEvent;
      if (await isBotUser(joined.user, teamId)) await handleBotJoinedChannel(joined, teamId);
      break;
    }
    case 'member_left_channel': {
      const left = event as MemberLeftChannelEvent;
      if (await isBotUser(left.user, teamId)) await handleBotLeftChannel(left, teamId);
      break;
    }
    case 'app_home_opened':
      await handleHomeOpened(event as AppHomeOpenedEvent, teamId);
      break;
    case 'app_uninstalled':
    case 'tokens_revoked':
      await purgeTeam(teamId);
      break;
  }
  return acknowledgeResponse();
}

/** Subscribes the channel the bot was added to, and says hello. */
async function handleBotJoinedChannel(event: MemberJoinedChannelEvent, teamId: string): Promise<void> {
  const { channel, inviter } = event;
  const client = await getSlackClient(teamId);
  // The name is only a label; a failed lookup (e.g. no groups:read on an old install) must not block the subscription.
  const channelName = await client.conversations
    .info({ channel })
    .then((info) => info.channel?.name || 'unknown')
    .catch((error) => {
      logger.warn('Channel name lookup failed', { channelId: channel, teamId, error });
      return 'unknown';
    });

  await subscribeChannel(channel, channelName, teamId, inviter);
  logger.info('Channel subscribed', { channelId: channel, channelName, teamId, invitedBy: inviter });

  try {
    await client.chat.postMessage({
      channel,
      text: "Thanks for adding me! I'll post conference deadline reminders here automatically.",
      blocks: [
        section(
          "👋 *Thanks for adding me!*\n\nI'll automatically post conference deadline reminders to this channel. Use `/conf-help` to see all available commands."
        ),
      ],
    });
  } catch (error) {
    logger.warn('Welcome message failed', { channelId: channel, teamId, error });
  }
}

// Not retried: the next open publishes again.
async function handleHomeOpened(event: AppHomeOpenedEvent, teamId: string): Promise<void> {
  if (event.tab !== 'home') return;
  try {
    await publishHome(event.user, teamId);
  } catch (error) {
    logger.warn('Home tab publish failed', { userId: event.user, teamId, error });
  }
}

async function handleBotLeftChannel(event: MemberLeftChannelEvent, teamId: string): Promise<void> {
  await unsubscribeChannel(event.channel);
  logger.info('Channel unsubscribed', { channelId: event.channel, teamId });
}

export const POST = withSlackMiddleware<SlackEventPayload>('json', handleSlackEvent);
