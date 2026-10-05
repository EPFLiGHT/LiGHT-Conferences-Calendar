/** Publishes a user's App Home tab, rebuilt from current data on every open and every toggle. */

import type { UserPreferences } from '@/types/slack';
import { getDaysUntilDeadline, getUpcomingDeadlines, getUpcomingEvents } from '@/utils/conferenceQueries';
import { getConferences } from './conferences';
import { buildHomeView } from './messages/home';
import { getSlackClient } from './slackClient';
import { defaultPreferences, getUserPreferences } from './userPreferences';

const DEADLINE_COUNT = 5;
const EVENT_COUNT = 3;

/** `prefs` skips the lookup when the caller has just saved them. */
export async function publishHome(userId: string, teamId?: string, prefs?: UserPreferences): Promise<void> {
  const [conferences, current] = await Promise.all([
    getConferences(),
    prefs ?? getUserPreferences(userId).then((saved) => saved ?? defaultPreferences(userId)),
  ]);
  const deadlines = getUpcomingDeadlines(conferences, DEADLINE_COUNT).map(({ conference, deadline }) => ({
    conference,
    deadline,
    daysLeft: getDaysUntilDeadline(deadline),
  }));

  const client = await getSlackClient(teamId);
  await client.views.publish({
    user_id: userId,
    view: buildHomeView({ prefs: current, deadlines, eventStarts: getUpcomingEvents(conferences, EVENT_COUNT) }),
  });
}
