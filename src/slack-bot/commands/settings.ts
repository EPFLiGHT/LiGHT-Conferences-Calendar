import type { BlockKitMessage } from '@/types/slack';
import { getUserPreferences, defaultPreferences } from '../lib/userPreferences';
import { buildSettingsPanel } from '../lib/messages/replies';
import type { CommandContext } from './index';

/** /conf-settings */
export async function handleSettings({ userId }: CommandContext): Promise<BlockKitMessage> {
  return buildSettingsPanel((await getUserPreferences(userId)) ?? defaultPreferences(userId));
}
