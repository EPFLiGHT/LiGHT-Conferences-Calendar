import { withCronAuth } from '@/slack-bot/lib/cronAuth';
import { successResponse } from '@/slack-bot/lib/responses';
import { runReminderJob } from '@/slack-bot/lib/reminderJob';
import { CHANNEL_DIGEST } from '@/slack-bot/lib/messages/digest';
import { getSubscribedChannels, unsubscribeChannel } from '@/slack-bot/lib/channelSubscriptions';
import { NOTIFICATION_CONFIG } from '@/slack-bot/config/constants';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** CHANNEL_REMINDER_DAYS (e.g. `30,7,3`), else the DM reminder days. */
function channelReminderDays(): readonly number[] {
  const days = (process.env.CHANNEL_REMINDER_DAYS ?? '')
    .split(',')
    .map((day) => parseInt(day.trim(), 10))
    .filter((day) => !isNaN(day));
  return days.length > 0 ? days : NOTIFICATION_CONFIG.REMINDER_DAYS;
}

/** Daily post in every channel the bot is in when a deadline or event start is a reminder day away. */
export const GET = withCronAuth(async () =>
  successResponse(
    await runReminderJob({
      name: 'channel-reminders',
      reminderDays: channelReminderDays(),
      digest: CHANNEL_DIGEST,
      loadTargets: async () =>
        (await getSubscribedChannels()).map((channel) => ({
          channel: channel.channelId,
          key: `channel:${channel.channelId}`,
          teamId: channel.teamId,
        })),
      dropTarget: (target) => unsubscribeChannel(target.channel),
    })
  )
);
