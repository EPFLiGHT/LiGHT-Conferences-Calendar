/**
 * Conference Helper Functions
 * Shared utilities for conference operations in Slack bot
 */

import type { Conference } from '@/types/conference';
import type { BlockKitMessage } from '@/types/slack';
import { getConferences } from '../utils/conferenceCache';
import { getUpcomingDeadlines } from '@/utils/conferenceQueries';
import { getNextDeadline } from '@/utils/parser';
import { buildConferenceCard, buildErrorMessage, buildDeadlineList } from './messageBuilder';

/**
 * Get conference details by ID and build a card message
 */
export async function getConferenceDetailsById(
  conferenceId: string
): Promise<BlockKitMessage> {
  const conferences = await getConferences();
  const conference = conferences.find((c) => c.id === conferenceId);

  if (!conference) {
    return buildErrorMessage(`Conference not found: ${conferenceId}`);
  }

  return buildConferenceDetailsCard(conference);
}

/**
 * Find conference by query (exact ID, title, or full name match)
 */
export async function findConferenceByQuery(
  query: string
): Promise<Conference | null> {
  const conferences = await getConferences();
  const normalizedQuery = query.toLowerCase().trim();

  // Try exact ID match first (case-insensitive)
  let conference = conferences.find((c) => c.id.toLowerCase() === normalizedQuery);

  // Fallback to fuzzy search by title or full name
  if (!conference) {
    const queryNoSpaces = normalizedQuery.replace(/\s+/g, '');
    conference = conferences.find((c) => {
      const titleMatch = c.title.toLowerCase().replace(/\s+/g, '');
      const fullNameMatch = c.full_name.toLowerCase().replace(/\s+/g, '');
      return titleMatch === queryNoSpaces || fullNameMatch.includes(queryNoSpaces);
    });
  }

  return conference || null;
}

/**
 * Build conference details card with deadline information
 * Handles both cases: with deadline and without deadline
 */
export function buildConferenceDetailsCard(
  conference: Conference
): BlockKitMessage {
  const deadline = getNextDeadline(conference);

  if (!deadline) {
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📅 *${conference.title} ${conference.year}*\n\n${conference.full_name}\n\n❌ No upcoming deadlines available for this conference.`,
          },
        },
      ],
      text: `${conference.title} ${conference.year} - No deadlines`,
    };
  }

  return buildConferenceCard(conference, deadline);
}

/**
 * Get upcoming conference deadlines
 * Shared function used by both /conf-upcoming command and channel reminders cron
 */
export async function getUpcomingConferencesMessage(
  count: number = 5
): Promise<BlockKitMessage> {
  const conferences = await getConferences();
  const upcoming = getUpcomingDeadlines(conferences, count);
  const message = buildDeadlineList(upcoming);

  return {
    ...message,
    response_type: 'in_channel',
  };
}
