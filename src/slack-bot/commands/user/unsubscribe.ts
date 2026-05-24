/**
 * /conf unsubscribe command
 * Disable deadline notifications for user
 */

import type { BlockKitMessage } from '@/types/slack';
import { disableNotifications } from '../../lib/userPreferences';
import { buildSuccessMessage } from '../../lib/messageBuilder';
import { withCommandHandler } from '../../lib/commandWrapper';

export async function handleUnsubscribe(userId: string): Promise<BlockKitMessage> {
  return withCommandHandler(
    'unsubscribe',
    userId,
    async () => {
      await disableNotifications(userId);

      return buildSuccessMessage(
        `🔕 *Notifications Disabled*\n\n` +
          `You will no longer receive deadline reminders.\n\n` +
          `You can re-enable them anytime with \`/conf-subscribe\`.`
      );
    },
    'Failed to disable notifications. Please try again later.'
  );
}
