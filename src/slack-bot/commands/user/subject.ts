/**
 * /conf subject <code> command
 * Filter conferences by subject (ML, CV, NLP, SEC, etc.)
 */

import type { BlockKitMessage } from '@/types/slack';
import { getConferences } from '../../utils/conferenceCache';
import { filterBySubject, getUpcomingDeadlines } from '@/utils/conferenceQueries';
import { buildDeadlineList } from '../../lib/messageBuilder';
import { SUBJECT_LABELS } from '@/constants/subjects';
import { withCommandHandler } from '../../lib/commandWrapper';

export async function handleSubject(userId: string, subjectCode: string): Promise<BlockKitMessage> {
  if (!subjectCode || subjectCode.trim() === '') {
    const availableSubjects = Object.entries(SUBJECT_LABELS)
      .map(([code, label]) => `• \`${code}\` - ${label}`)
      .join('\n');

    return {
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `📚 *Available Subjects:*\n${availableSubjects}\n\n*Usage:* \`/conf-subject ML\``,
          },
        },
      ],
      text: 'Please specify a subject code',
      response_type: 'in_channel',
    };
  }

  const subject = subjectCode.toUpperCase();

  return withCommandHandler(
    'subject',
    userId,
    async () => {
      const conferences = await getConferences();
      const filtered = filterBySubject(conferences, subject);

      if (filtered.length === 0) {
        return {
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `❌ No conferences found for subject "*${subject}*"\n\nUse \`/conf-subject\` without arguments to see available subjects.`,
              },
            },
          ],
          text: `No conferences found for subject: ${subject}`,
          response_type: 'in_channel',
        };
      }

      const upcoming = getUpcomingDeadlines(filtered, 10);
      const subjectLabel = SUBJECT_LABELS[subject] || subject;
      const message = buildDeadlineList(upcoming);

      return {
        ...message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📚 *${subjectLabel} Conferences* - Found ${filtered.length} conference(s)`,
            },
          },
          { type: 'divider' },
          ...message.blocks.slice(1),
        ],
        response_type: 'in_channel',
      };
    },
    'Failed to filter conferences. Please try again later.',
    { subject }
  );
}
