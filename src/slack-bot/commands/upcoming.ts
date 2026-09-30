import type { BlockKitMessage } from '@/types/slack';
import { getDaysUntilDeadline, getUpcomingDeadlines, getUpcomingEvents } from '@/utils/conferenceQueries';
import { getConferences } from '../lib/conferences';
import { buildDigest, CHANNEL_DIGEST } from '../lib/messages/digest';

const COUNT = 5;

/** /conf-upcoming: the next deadlines and the next event starts, in the channel digest layout. */
export async function handleUpcoming(): Promise<BlockKitMessage> {
  const conferences = await getConferences();
  const deadlines = getUpcomingDeadlines(conferences, COUNT).map(({ conference, deadline }) => ({
    conference,
    deadline,
    daysLeft: getDaysUntilDeadline(deadline),
  }));

  return buildDigest({
    ...CHANNEL_DIGEST,
    deadlines,
    eventStarts: getUpcomingEvents(conferences, COUNT),
    date: new Date(),
  });
}
