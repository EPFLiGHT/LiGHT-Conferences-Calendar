/** The App Home tab: the user's reminders, the next deadlines and event starts, and links to the site. */

import type { Button, HomeView, KnownBlock } from '@slack/web-api';
import type { UserPreferences } from '@/types/slack';
import { SITE_URL } from '@/constants/routes';
import { cardList, type ConferenceCardItem, type DeadlineItem, type EventStartItem } from './cards';
import { reminderDaysText, remindersButton } from './replies';
import { context, divider, header, section } from './blocks';

interface HomeParams {
  prefs: UserPreferences;
  deadlines: DeadlineItem[];
  eventStarts: EventStartItem[];
}

export function buildHomeView({ prefs, deadlines, eventStarts }: HomeParams): HomeView {
  return {
    type: 'home',
    blocks: [
      header('📡 LiGHT Events Radar'),
      context('Conferences, summits and workshops in global health, humanitarian response and AI.'),
      divider,
      remindersSection(prefs.notificationsEnabled),
      divider,
      ...listSection(
        '*⏳ Next deadlines*',
        deadlines.map((d) => ({ kind: 'deadline' as const, ...d })),
        'No upcoming deadlines right now.'
      ),
      divider,
      ...listSection(
        '*🎟️ Starting soon*',
        eventStarts.map((e) => ({ kind: 'event' as const, ...e })),
        'No upcoming events right now.'
      ),
      divider,
      {
        type: 'actions',
        elements: [
          linkButton('🌐 Open website', SITE_URL, 'home_website'),
          linkButton('📅 Calendar', `${SITE_URL}/calendar`, 'home_calendar'),
        ],
      },
      context('Type `/conf-help` in any conversation to see all commands.'),
    ],
  };
}

function remindersSection(enabled: boolean): KnownBlock {
  const days = reminderDaysText();
  const status = enabled
    ? `✅ On. You'll get a DM ${days} days before each deadline and event start.`
    : `Off. Turn them on to get a DM ${days} days before each deadline and event start.`;
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: `*🔔 Your reminders*\n${status}` },
    accessory: remindersButton(enabled, enabled ? 'Turn off' : 'Turn on'),
  };
}

function listSection(heading: string, items: ConferenceCardItem[], empty: string): KnownBlock[] {
  return [section(heading), ...(items.length > 0 ? cardList(items) : [context(`_${empty}_`)])];
}

function linkButton(text: string, url: string, actionId: string): Button {
  return { type: 'button', text: { type: 'plain_text', text, emoji: true }, url, action_id: actionId };
}
