/**
 * Conference Helper Functions
 * Shared utilities for conference operations in Slack bot
 */

import type { Conference } from '@/types/conference';
import type { BlockKitMessage } from '@/types/slack';
import { getConferences } from '../utils/conferenceCache';
import { getUpcomingDeadlines, getUpcomingEvents, getDaysUntilDeadline } from '@/utils/conferenceQueries';
import { getNextDeadline } from '@/utils/parser';
import { buildConferenceItemBlocks, buildErrorMessage, buildChannelDigest } from './messageBuilder';

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

  // Extra detail shown beneath the unified card: full name, location, and note.
  const detail: string[] = [conference.full_name];
  if (conference.place) detail.push(`📍 ${conference.place}`);
  if (conference.note) detail.push(`ℹ️ ${conference.note}`);
  const detailBlock: any = {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: detail.join('  ·  ') }],
  };

  if (!deadline) {
    const noDeadlineText =
      conference.deadline_status === 'attendance'
        ? 'Registration only, no submission.'
        : conference.deadline_status === 'tba'
          ? 'Deadline to be announced.'
          : 'No upcoming deadline announced yet.';
    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📅 *${conference.title} ${conference.year}*\n_${noDeadlineText}_`,
          },
        },
        detailBlock,
      ],
      text: `${conference.title} ${conference.year} - ${noDeadlineText}`,
    };
  }

  return {
    blocks: [
      ...buildConferenceItemBlocks({
        kind: 'deadline',
        conference,
        deadline,
        daysLeft: getDaysUntilDeadline(deadline),
      }),
      detailBlock,
    ],
    text: `${conference.title} ${conference.year} - ${deadline.label}`,
  };
}

/**
 * Build the /conf-upcoming message: the next `count` submission deadlines AND
 * the next `count` conferences whose event start is approaching, rendered with
 * the same unified digest layout used for the daily channel post.
 */
export async function getUpcomingConferencesMessage(
  count: number = 5
): Promise<BlockKitMessage> {
  const conferences = await getConferences();

  const deadlines = getUpcomingDeadlines(conferences, count).map(
    ({ conference, deadline }) => ({
      conference,
      deadline,
      daysLeft: getDaysUntilDeadline(deadline),
    })
  );
  const eventStarts = getUpcomingEvents(conferences, count);

  return buildChannelDigest({
    deadlines,
    eventStarts,
    date: new Date(),
    maxItems: count,
  });
}
