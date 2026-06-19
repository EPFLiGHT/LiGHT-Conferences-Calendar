/**
 * /conf-help command
 * Show all available commands
 */

import type { BlockKitMessage } from '@/types/slack';
import { buildHelpMessage } from '../../lib/messageBuilder';
import { logger } from '../../utils/logger';

export async function handleHelp(userId: string): Promise<BlockKitMessage> {
  logger.info('Handling help command', { userId });
  return buildHelpMessage();
}
