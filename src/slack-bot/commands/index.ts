/** Handlers for the slash commands listed in config/constants COMMANDS. */

import type { BlockKitMessage } from '@/types/slack';
import type { CommandName } from '../config/constants';
import { buildHelpMessage } from '../lib/messages/replies';
import { handleUpcoming } from './upcoming';
import { handleSearch } from './search';
import { handleSubject } from './subject';
import { handleInfo } from './info';
import { handleSubscribe, handleUnsubscribe } from './notifications';
import { handleSettings } from './settings';

export interface CommandContext {
  userId: string;
  /** Command arguments, trimmed. */
  text: string;
  teamId?: string;
}

/** May throw; the commands route turns errors into a user-facing reply. */
export type CommandHandler = (context: CommandContext) => Promise<BlockKitMessage>;

const HANDLERS: Record<CommandName, CommandHandler> = {
  '/conf-upcoming': handleUpcoming,
  '/conf-search': handleSearch,
  '/conf-subject': handleSubject,
  '/conf-info': handleInfo,
  '/conf-subscribe': handleSubscribe,
  '/conf-unsubscribe': handleUnsubscribe,
  '/conf-settings': handleSettings,
  '/conf-help': async () => buildHelpMessage(),
};

export function commandHandler(command: string): CommandHandler | undefined {
  return Object.hasOwn(HANDLERS, command) ? HANDLERS[command as CommandName] : undefined;
}
