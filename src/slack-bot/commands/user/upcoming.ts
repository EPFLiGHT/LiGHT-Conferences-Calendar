/**
 * /conf-upcoming command
 * Shows the next 5 upcoming conference deadlines
 */

import type { BlockKitMessage } from '@/types/slack';
import { getUpcomingConferencesMessage } from '../../lib/conferenceHelpers';
import { withCommandHandler } from '../../lib/commandWrapper';

export async function handleUpcoming(userId: string): Promise<BlockKitMessage> {
  return withCommandHandler(
    'upcoming',
    userId,
    async () => {
      return getUpcomingConferencesMessage(5);
    },
    'Failed to fetch upcoming deadlines. Please try again later.'
  );
}
