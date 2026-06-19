/**
 * /conf-search <query> command
 * Search conferences by name
 */

import type { BlockKitMessage } from '@/types/slack';
import { getConferences } from '../../utils/conferenceCache';
import { searchConferences, getUpcomingDeadlines } from '@/utils/conferenceQueries';
import { buildDeadlineList, buildErrorMessage } from '../../lib/messageBuilder';
import { withCommandHandler } from '../../lib/commandWrapper';

export async function handleSearch(userId: string, query: string): Promise<BlockKitMessage> {
  if (!query || query.trim() === '') {
    return buildErrorMessage('Please provide a search query. Example: `/conf-search CVPR`');
  }

  return withCommandHandler(
    'search',
    userId,
    async () => {
      const conferences = await getConferences();
      const results = searchConferences(conferences, query);

      if (results.length === 0) {
        return {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `🔍 No conferences found matching "*${query}*"\n\nTry a different search term or use \`/conf-upcoming\` to see all upcoming deadlines.`,
              },
            },
          ],
          text: `No results found for: ${query}`,
        };
      }

      const upcoming = getUpcomingDeadlines(results, 10);
      const message = buildDeadlineList(upcoming);

      return {
        ...message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `🔍 *Search Results for "${query}"* - Found ${results.length} conference(s)`,
            },
          },
          { type: 'divider' },
          ...message.blocks.slice(1), // skip the default header
        ],
      };
    },
    'Failed to search conferences. Please try again later.',
    { query }
  );
}
