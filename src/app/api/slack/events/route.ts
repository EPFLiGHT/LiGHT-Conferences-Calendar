import { NextResponse } from 'next/server';
import { withSlackMiddleware, SlackRequestType } from '@/slack-bot/lib/middleware';
import { acknowledgeResponse } from '@/slack-bot/lib/responses';
import { subscribeChannel, unsubscribeChannel } from '@/slack-bot/lib/channelSubscriptions';
import { getSlackClient } from '@/slack-bot/lib/slackClient';
import { getTeamMetadata } from '@/slack-bot/lib/teamStorage';
import { logger } from '@/slack-bot/utils/logger';
import type {
  SlackEventPayload,
  MemberJoinedChannelEvent,
  MemberLeftChannelEvent,
} from '@/types/slack-payloads';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Handle Slack Event API callbacks
 */
async function handleSlackEvent(
  payload: SlackEventPayload,
  _request: unknown,
  teamId?: string
): Promise<NextResponse> {
  // Slack sends this when setting up the Events API
  if (payload.type === 'url_verification') {
    return NextResponse.json({ challenge: payload.challenge });
  }

  if (payload.type === 'event_callback' && payload.event) {
    logger.info('Received event', { type: payload.event.type, teamId });

    // Handle bot being added to a channel
    if (payload.event.type === 'member_joined_channel') {
      const event = payload.event as MemberJoinedChannelEvent;
      if (await isBotUser(event.user, teamId || event.team)) {
        await handleBotJoinedChannel(event, teamId);
      }
    }

    // Handle bot being removed from a channel
    if (payload.event.type === 'member_left_channel') {
      const event = payload.event as MemberLeftChannelEvent;
      if (await isBotUser(event.user, teamId || event.team)) {
        await handleBotLeftChannel(event, teamId);
      }
    }

    // Future feature: Handle other Slack events
    // - app_mention: Respond when bot is @mentioned in a channel
    // - message: Respond to DMs or specific message patterns
    // - app_home_opened: Show custom home tab with personalized deadlines

    return acknowledgeResponse();
  }

  return acknowledgeResponse();
}

/**
 * Check whether a Slack user ID refers to this app's bot user for the team.
 * Prefers cached botUserId from team metadata, falls back to auth.test.
 */
const botUserIdCache = new Map<string, string>();

async function isBotUser(userId: string | undefined, teamId?: string): Promise<boolean> {
  if (!userId) return false;
  const cacheKey = teamId || 'default';

  let botUserId = botUserIdCache.get(cacheKey);
  if (!botUserId && teamId) {
    const metadata = await getTeamMetadata(teamId);
    if (metadata?.botUserId) {
      botUserId = metadata.botUserId;
      botUserIdCache.set(cacheKey, botUserId);
    }
  }

  if (!botUserId) {
    try {
      const client = await getSlackClient(teamId);
      const auth = await client.auth.test();
      if (auth.user_id) {
        botUserId = auth.user_id;
        botUserIdCache.set(cacheKey, botUserId);
      }
    } catch (error) {
      logger.warn('auth.test failed while identifying bot user', { teamId, error });
      return false;
    }
  }

  return botUserId === userId;
}

/**
 * Handle bot being added to a channel
 * Automatically subscribes the channel to receive deadline reminders
 */
async function handleBotJoinedChannel(
  event: MemberJoinedChannelEvent,
  teamId?: string
): Promise<void> {
  try {
    const { channel, user, inviter, team } = event;
    const actualTeamId = teamId || team;

    logger.info('Bot joined channel', {
      channelId: channel,
      botUserId: user,
      invitedBy: inviter,
      teamId: actualTeamId,
    });

    // Get channel info to get the channel name
    const client = await getSlackClient(actualTeamId);
    const channelInfo = await client.conversations.info({ channel });

    const channelName = channelInfo.channel?.name || 'unknown';

    // Subscribe the channel
    await subscribeChannel(channel, channelName, actualTeamId, inviter);

    logger.info('Channel automatically subscribed', {
      channelId: channel,
      channelName,
      teamId: actualTeamId,
    });

    // Optionally, send a welcome message to the channel
    try {
      await client.chat.postMessage({
        channel,
        text: 'Thanks for adding me! I\'ll post conference deadline reminders here automatically.',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '👋 *Thanks for adding me!*\n\nI\'ll automatically post conference deadline reminders to this channel. Use `/conf help` to see all available commands.',
            },
          },
        ],
      });
    } catch (msgError) {
      // Don't fail if we can't send the welcome message
      logger.warn('Failed to send welcome message', { channel, error: msgError });
    }
  } catch (error) {
    logger.error('Failed to handle bot joined channel event', error, {
      event,
    });
  }
}

/**
 * Handle bot being removed from a channel
 * Automatically unsubscribes the channel from reminders
 */
async function handleBotLeftChannel(
  event: MemberLeftChannelEvent,
  teamId?: string
): Promise<void> {
  try {
    const { channel, user, team } = event;
    const actualTeamId = teamId || team;

    logger.info('Bot left channel', {
      channelId: channel,
      botUserId: user,
      teamId: actualTeamId,
    });

    // Unsubscribe the channel
    await unsubscribeChannel(channel);

    logger.info('Channel automatically unsubscribed', {
      channelId: channel,
      teamId: actualTeamId,
    });
  } catch (error) {
    logger.error('Failed to handle bot left channel event', error, {
      event,
    });
  }
}

export const POST = withSlackMiddleware<SlackEventPayload>({
  requestType: SlackRequestType.JSON,
  handler: handleSlackEvent,
});
