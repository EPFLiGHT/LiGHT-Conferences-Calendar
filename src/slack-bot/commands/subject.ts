import type { BlockKitMessage } from '@/types/slack';
import { filterBySubject, getUpcomingDeadlines } from '@/utils/conferenceQueries';
import { SUBJECT_LABELS, resolveSubjectCode } from '@/constants/subjects';
import { getConferences } from '../lib/conferences';
import { buildDeadlineList } from '../lib/messages/replies';
import { plural, section } from '../lib/messages/blocks';
import type { CommandContext } from './index';

/** /conf-subject <code>; lists the subject codes when none is given. */
export async function handleSubject({ text }: CommandContext): Promise<BlockKitMessage> {
  if (!text) {
    const available = Object.entries(SUBJECT_LABELS)
      .map(([code, label]) => `• \`${code}\` - ${label}`)
      .join('\n');
    return {
      blocks: [section(`📚 *Available Subjects:*\n${available}\n\n*Usage:* \`/conf-subject ML\``)],
      text: 'Please specify a subject code',
    };
  }

  const subject = resolveSubjectCode(text) ?? text;
  const filtered = filterBySubject(await getConferences(), subject);
  if (filtered.length === 0) {
    return {
      blocks: [
        section(
          `❌ No conferences found for subject "*${subject}*"\n\nUse \`/conf-subject\` without arguments to see available subjects.`
        ),
      ],
      text: `No conferences found for subject: ${subject}`,
    };
  }

  return buildDeadlineList(
    `📚 ${SUBJECT_LABELS[subject] || subject} Conferences`,
    `Found ${plural(filtered.length, 'conference')}`,
    getUpcomingDeadlines(filtered, 10)
  );
}
