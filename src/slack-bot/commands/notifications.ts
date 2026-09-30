import type { BlockKitMessage } from '@/types/slack';
import { enableNotifications, disableNotifications } from '../lib/userPreferences';
import { buildSuccessMessage, reminderDaysText } from '../lib/messages/replies';
import type { CommandContext } from './index';

/** /conf-subscribe */
export async function handleSubscribe({ userId, teamId }: CommandContext): Promise<BlockKitMessage> {
  await enableNotifications(userId, teamId);
  return buildSuccessMessage(
    `🔔 *Notifications Enabled!*\n\n` +
      `You'll now receive deadline reminders ${reminderDaysText()} days before deadlines.\n\n` +
      `Use \`/conf-settings\` to view your settings, or \`/conf-unsubscribe\` to stop.`
  );
}

/** /conf-unsubscribe */
export async function handleUnsubscribe({ userId }: CommandContext): Promise<BlockKitMessage> {
  await disableNotifications(userId);
  return buildSuccessMessage(
    `🔕 *Notifications Disabled*\n\n` +
      `You will no longer receive deadline reminders.\n\n` +
      `You can re-enable them anytime with \`/conf-subscribe\`.`
  );
}
