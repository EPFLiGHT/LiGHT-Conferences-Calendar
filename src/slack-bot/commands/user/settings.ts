/**
 * /conf-settings command
 * View and manage notification preferences
 */

import type { BlockKitMessage } from '@/types/slack';
import { getUserPreferences, updateUserPreferences } from '../../lib/userPreferences';
import { buildSettingsPanel } from '../../lib/messageBuilder';
import { withCommandHandler } from '../../lib/commandWrapper';
import { NOTIFICATION_CONFIG } from '../../config/constants';

export async function handleSettings(userId: string): Promise<BlockKitMessage> {
  return withCommandHandler(
    'settings',
    userId,
    async () => {
      let prefs = await getUserPreferences(userId);

      if (!prefs) {
        // user doesn't exist yet, create default prefs
        prefs = await updateUserPreferences(userId, {
          notificationsEnabled: false,
          timezone: NOTIFICATION_CONFIG.DEFAULT_TIMEZONE,
          reminderDays: [...NOTIFICATION_CONFIG.DEFAULT_REMINDER_DAYS],
          subjects: [],
        });
      }

      return buildSettingsPanel(prefs);
    },
    'Failed to load settings. Please try again later.'
  );
}
