import { NextResponse } from 'next/server';
import { withSlackMiddleware, SlackRequestType } from '@/slack-bot/lib/middleware';
import { successResponse, errorResponse } from '@/slack-bot/lib/responses';
import { getConferences } from '@/slack-bot/utils/conferenceCache';
import { getAllUsersWithNotifications } from '@/slack-bot/lib/userPreferences';
import { sendDM } from '@/slack-bot/lib/slackClient';
import {
  buildUserDeadlineNotification,
  buildEventStartNotification,
} from '@/slack-bot/lib/messageBuilder';
import {
  getDeadlinesWithinDays,
  filterBySubject,
  getEventStartsOnDays,
} from '@/utils/conferenceQueries';
import { logger } from '@/slack-bot/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * This endpoint should be called by a cron job (e.g., Vercel Cron)
 * It checks for upcoming deadlines and sends notifications to subscribed users
 */
async function handleDailyCheck(): Promise<NextResponse> {
  try {
    // Get all conferences
    const allConferences = await getConferences();

    // Get all users with notifications enabled
    const users = await getAllUsersWithNotifications();

    logger.info('Running daily notification check', {
      totalUsers: users.length,
      totalConferences: allConferences.length
    });

    let notificationsSent = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // Process each user
    for (const user of users) {
      // Validate user has slackUserId early
      if (!user.slackUserId) {
        logger.warn('User missing slackUserId', { user });
        continue;
      }

      const userId = user.slackUserId; // Type narrowing, available in both try and catch

      try {
        // Filter conferences by user's subject preferences (if any)
        let userConferences = allConferences;
        if (user.subjects && user.subjects.length > 0) {
          userConferences = user.subjects.flatMap(subject =>
            filterBySubject(allConferences, subject)
          );
          // Remove duplicates
          userConferences = Array.from(new Map(
            userConferences.map(c => [c.id, c])
          ).values());
        }

        // Find the maximum reminder day threshold for this user
        const maxReminderDays = Math.max(...user.reminderDays);

        // Get deadlines within the user's reminder window
        const upcomingDeadlines = getDeadlinesWithinDays(
          userConferences,
          maxReminderDays
        );

        // Fire exactly on each of the user's reminder days
        // (e.g. 30, 7, 3 days out) — no day-by-day repeats.
        const relevantDeadlines = upcomingDeadlines.filter(item =>
          user.reminderDays.includes(item.daysLeft)
        );
        const upcomingEventStarts = getEventStartsOnDays(
          userConferences,
          user.reminderDays
        );

        if (relevantDeadlines.length === 0 && upcomingEventStarts.length === 0) {
          logger.debug('Nothing relevant for user today', { userId });
          continue;
        }

        // Compose a single DM combining deadline reminders and event-start
        // reminders so users get at most one message per day.
        const combinedBlocks: any[] = [];
        const fallbackParts: string[] = [];

        if (relevantDeadlines.length > 0) {
          const deadlineMsg = buildUserDeadlineNotification(relevantDeadlines);
          combinedBlocks.push(...deadlineMsg.blocks);
          if (deadlineMsg.text) fallbackParts.push(deadlineMsg.text);
        }

        if (upcomingEventStarts.length > 0) {
          if (combinedBlocks.length > 0) {
            combinedBlocks.push({ type: 'divider' });
          }
          const eventMsg = buildEventStartNotification(upcomingEventStarts);
          combinedBlocks.push(...eventMsg.blocks);
          if (eventMsg.text) fallbackParts.push(eventMsg.text);
        }

        await sendDM(userId, combinedBlocks, fallbackParts.join(' • '), user.teamId);

        notificationsSent++;
        logger.info('Sent notification to user', {
          userId,
          deadlineCount: relevantDeadlines.length,
          eventStartCount: upcomingEventStarts.length,
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to send notification to user', error, {
          userId
        });
        errors.push({
          userId,
          error: errorMessage
        });
      }
    }

    logger.info('Daily notification check completed', {
      totalUsers: users.length,
      notificationsSent,
      errors: errors.length
    });

    return successResponse({
      success: true,
      totalUsers: users.length,
      notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Error in daily check cron', error);
    return errorResponse('Internal server error', 500);
  }
}

export const GET = withSlackMiddleware({
  requestType: SlackRequestType.CRON,
  handler: handleDailyCheck,
  authConfig: {
    requireAuth: true,
  },
});
