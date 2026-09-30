import type { BlockKitMessage } from '@/types/slack';
import { searchConferences, getUpcomingDeadlines } from '@/utils/conferenceQueries';
import { getConferences } from '../lib/conferences';
import { buildDeadlineList, buildErrorMessage } from '../lib/messages/replies';
import { plural, section } from '../lib/messages/blocks';
import type { CommandContext } from './index';

/** /conf-search <query> */
export async function handleSearch({ text: query }: CommandContext): Promise<BlockKitMessage> {
  if (!query) {
    return buildErrorMessage('Please provide a search query. Example: `/conf-search CVPR`');
  }

  const results = searchConferences(await getConferences(), query);
  if (results.length === 0) {
    return {
      blocks: [
        section(
          `🔍 No conferences found matching "*${query}*"\n\nTry a different search term or use \`/conf-upcoming\` to see all upcoming deadlines.`
        ),
      ],
      text: `No results found for: ${query}`,
    };
  }

  return buildDeadlineList(
    `🔍 Search results for "${query}"`,
    `Found ${plural(results.length, 'conference')}`,
    getUpcomingDeadlines(results, 10)
  );
}
