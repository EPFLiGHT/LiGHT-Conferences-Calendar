/**
 * Channel Reminders Cron Job
 * Posts upcoming conference deadlines to all subscribed Slack channels
 * across all workspaces.
 *
 * Uses smart filtering to only post when deadlines are within specific reminder days
 * (e.g., 30, 7, 3 days before deadline), similar to DM notifications.
 * This prevents spamming the channel with the same deadlines every day.
 */

import { NextResponse } from 'next/server';
import { withSlackMiddleware, SlackRequestType } from '@/slack-bot/lib/middleware';
import { getConferences } from '@/slack-bot/utils/conferenceCache';
import { getDeadlinesWithinDays, getEventStartsOnDays } from '@/utils/conferenceQueries';
import { postToChannel } from '@/slack-bot/lib/slackClient';
import { buildChannelDigest } from '@/slack-bot/lib/messageBuilder';
import {
  getAllActiveChannels,
  updateChannelLastPosted,
  unsubscribeChannel,
  unsubscribeTeamChannels,
} from '@/slack-bot/lib/channelSubscriptions';
import { removeTeamData } from '@/slack-bot/lib/teamStorage';
import { clearTeamClient } from '@/slack-bot/lib/slackClient';
import { logger } from '@/slack-bot/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Default reminder days for channel notifications
 * Will notify when deadlines are exactly these days away (±1 day margin)
 */
const DEFAULT_CHANNEL_REMINDER_DAYS = [30, 7, 3];

/**
 * GET handler for the cron job
 * Protected by Vercel Cron secret or authorization header
 */
async function handleChannelReminders(): Promise<NextResponse> {
  try {
    const subscribedChannels = await getAllActiveChannels();

    if (subscribedChannels.length === 0) {
      logger.info('No subscribed channels found');
      return NextResponse.json({
        success: true,
        message: 'No subscribed channels',
        count: 0,
      });
    }

    logger.info('Starting channel reminders', {
      channelCount: subscribedChannels.length,
      channels: subscribedChannels.map(c => ({
        id: c.channelId,
        name: c.channelName,
        teamId: c.teamId,
      })),
    });

    // Parse reminder days from environment or use defaults
    const reminderDaysStr = process.env.CHANNEL_REMINDER_DAYS || '';
    const reminderDays = reminderDaysStr
      ? reminderDaysStr.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d))
      : DEFAULT_CHANNEL_REMINDER_DAYS;

    const allConferences = await getConferences();

    // Find the maximum reminder day threshold
    const maxReminderDays = Math.max(...reminderDays);

    // Get deadlines within the reminder window
    const upcomingDeadlines = getDeadlinesWithinDays(
      allConferences,
      maxReminderDays
    );

    // Fire exactly on each configured reminder day (e.g. 30, 7, 3 days out)
    // so the same item isn't re-posted on consecutive days.
    const relevantDeadlines = upcomingDeadlines.filter(item =>
      reminderDays.includes(item.daysLeft)
    );
    const upcomingEventStarts = getEventStartsOnDays(allConferences, reminderDays);

    if (relevantDeadlines.length === 0 && upcomingEventStarts.length === 0) {
      logger.info('No relevant deadlines or event starts for channel notification', {
        upcomingCount: upcomingDeadlines.length,
        reminderDays,
      });
      return NextResponse.json({
        success: true,
        message: 'Nothing relevant to post today',
        count: 0,
      });
    }

    const digest = buildChannelDigest({
      deadlines: relevantDeadlines,
      eventStarts: upcomingEventStarts,
      date: new Date(),
    });

    // Post to all subscribed channels
    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const channel of subscribedChannels) {
      try {
        await postToChannel(
          channel.channelId,
          digest.blocks,
          digest.text ?? 'Conference Reminders',
          channel.teamId
        );

        await updateChannelLastPosted(channel.channelId);

        logger.info('Posted reminders to channel', {
          channelId: channel.channelId,
          channelName: channel.channelName,
          teamId: channel.teamId,
          deadlines: relevantDeadlines.length,
          eventStarts: upcomingEventStarts.length,
        });

        successCount++;
      } catch (error) {
        failureCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${channel.channelName} (${channel.channelId}): ${errorMsg}`);

        logger.error('Failed to post to channel', error, {
          channelId: channel.channelId,
          channelName: channel.channelName,
          teamId: channel.teamId,
        });

        // Auto-clean dead workspaces/channels so we stop retrying forever.
        if (errorMsg.includes('account_inactive') || errorMsg.includes('token_revoked')) {
          await unsubscribeTeamChannels(channel.teamId);
          await removeTeamData(channel.teamId);
          clearTeamClient(channel.teamId);
        } else if (
          errorMsg.includes('channel_not_found') ||
          errorMsg.includes('is_archived') ||
          errorMsg.includes('not_in_channel')
        ) {
          await unsubscribeChannel(channel.channelId);
        }
      }
    }

    return NextResponse.json({
      success: successCount > 0,
      message: `Reminders posted to ${successCount}/${subscribedChannels.length} channels`,
      deadlineCount: relevantDeadlines.length,
      eventStartCount: upcomingEventStarts.length,
      channelCount: subscribedChannels.length,
      successCount,
      failureCount,
      reminderDays,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Error in channel reminders cron', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Failed to post reminders',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

export const GET = withSlackMiddleware({
  requestType: SlackRequestType.CRON,
  handler: handleChannelReminders,
  authConfig: {
    requireAuth: true,
  },
});
