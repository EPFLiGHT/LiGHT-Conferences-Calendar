import type { Conference } from '@/types/conference';
import type { BlockKitMessage } from '@/types/slack';
import { searchConferences } from '@/utils/conferenceQueries';
import { getConferences } from '../lib/conferences';
import { buildConferenceDetails } from '../lib/messages/cards';
import { buildErrorMessage } from '../lib/messages/replies';
import type { CommandContext } from './index';

/** /conf-info <id-or-name> */
export async function handleInfo({ text: query }: CommandContext): Promise<BlockKitMessage> {
  if (!query) {
    return buildErrorMessage(
      'Please provide a conference ID or name. Example: `/conf-info cvpr25` or `/conf-info CVPR`\n\nYou can find conference IDs in the deadline lists.'
    );
  }

  const conference = findConference(await getConferences(), query);
  if (!conference) {
    return buildErrorMessage(
      `Conference "${query}" not found.\n\nUse \`/conf-search ${query}\` to find similar conferences.`
    );
  }
  return buildConferenceDetails(conference);
}

/** The conference with this ID, else the first search hit, preferring an exact title match. */
export function findConference(conferences: Conference[], query: string): Conference | undefined {
  const normalized = query.toLowerCase().replace(/\s+/g, '');
  const byId = conferences.find((c) => c.id.toLowerCase() === normalized);
  if (byId) return byId;

  const results = searchConferences(conferences, query);
  return results.find((c) => c.title.toLowerCase().replace(/\s+/g, '') === normalized) ?? results[0];
}
