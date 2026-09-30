import { withCronAuth } from '@/slack-bot/lib/cronAuth';
import { successResponse } from '@/slack-bot/lib/responses';
import { runReminderJob } from '@/slack-bot/lib/reminderJob';
import { DM_DIGEST } from '@/slack-bot/lib/messages/digest';
import { disableNotifications, getAllUsersWithNotifications } from '@/slack-bot/lib/userPreferences';
import { NOTIFICATION_CONFIG } from '@/slack-bot/config/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Daily DM to every subscribed user when a deadline or event start is a reminder day away. */
export const GET = withCronAuth(async () =>
  successResponse(
    await runReminderJob({
      name: 'daily-check',
      reminderDays: NOTIFICATION_CONFIG.REMINDER_DAYS,
      digest: DM_DIGEST,
      loadTargets: async () =>
        (await getAllUsersWithNotifications()).map((user) => ({
          channel: user.slackUserId,
          key: `dm:${user.slackUserId}`,
          teamId: user.teamId,
        })),
      dropTarget: (target) => disableNotifications(target.channel),
    })
  )
);
