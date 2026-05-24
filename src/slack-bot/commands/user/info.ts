/**
 * /conf info <conference-id> command
 * Get detailed information about a specific conference
 */

import type { BlockKitMessage } from '@/types/slack';
import { buildErrorMessage } from '../../lib/messageBuilder';
import { withCommandHandler } from '../../lib/commandWrapper';
import { findConferenceByQuery, buildConferenceDetailsCard } from '../../lib/conferenceHelpers';

export async function handleInfo(userId: string, conferenceQuery: string): Promise<BlockKitMessage> {
  if (!conferenceQuery || conferenceQuery.trim() === '') {
    return buildErrorMessage(
      'Please provide a conference ID or name. Example: `/conf-info cvpr25` or `/conf-info CVPR`\n\nYou can find conference IDs in the deadline lists.'
    );
  }

  return withCommandHandler(
    'info',
    userId,
    async () => {
      const conference = await findConferenceByQuery(conferenceQuery);

      if (!conference) {
        return buildErrorMessage(
          `Conference "${conferenceQuery}" not found.\n\nUse \`/conf-search ${conferenceQuery}\` to find similar conferences.`
        );
      }

      return buildConferenceDetailsCard(conference);
    },
    'Failed to fetch conference information. Please try again later.',
    { conferenceQuery }
  );
}
