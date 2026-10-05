/** The App Home tab. */

import type { Button, HomeView, KnownBlock } from '@slack/web-api';
import type { Conference } from '@/types/conference';
import type { UserPreferences } from '@/types/slack';
import { SITE_URL } from '@/constants/routes';
import { NOTIFICATION_CONFIG } from '../../config/constants';
import {
  formatDeadlineUrgency,
  formatEventCountdown,
  urgencyEmoji,
  type DeadlineItem,
  type EventStartItem,
} from './cards';
import { remindersButton } from './replies';
import { context, divider, header, section } from './blocks';

const DATE_FORMAT = 'MMM d';

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
      context('Global Health, Humanitarian & AI Events'),
      divider,
      remindersSection(prefs.notificationsEnabled),
      divider,
      listSection('⏳ Next deadlines', deadlines.map(deadlineLine), 'No upcoming deadlines right now.'),
      listSection('🎟️ Starting soon', eventStarts.map(eventLine), 'No upcoming events right now.'),
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
  const days = NOTIFICATION_CONFIG.REMINDER_DAYS;
  const when = `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]} days before each deadline and event start`;
  const text = enabled
    ? `*🔔 Reminders are on*\nYou'll get a DM ${when}.`
    : `*🔕 Reminders are off*\nTurn them on to get a DM ${when}.`;
  return {
    type: 'section',
    text: { type: 'mrkdwn', text },
    accessory: remindersButton(enabled, enabled ? 'Turn off' : 'Turn on'),
  };
}

function listSection(heading: string, lines: string[], empty: string): KnownBlock {
  return section(`*${heading}*\n${lines.length > 0 ? lines.join('\n') : `_${empty}_`}`);
}

function deadlineLine({ conference, deadline, daysLeft }: DeadlineItem): string {
  const details = [deadline.label, deadline.datetime.toFormat(DATE_FORMAT), formatDeadlineUrgency(daysLeft)];
  return `${urgencyEmoji(daysLeft)} ${eventName(conference)}  ${details.join(' · ')}`;
}

function eventLine({ conference, start, daysLeft }: EventStartItem): string {
  const details = [conference.place, start.toFormat(DATE_FORMAT), formatEventCountdown(daysLeft)].filter(Boolean);
  return `• ${eventName(conference)}  ${details.join(' · ')}`;
}

function eventName({ title, year, link }: Conference): string {
  return link ? `*<${link}|${title} ${year}>*` : `*${title} ${year}*`;
}

function linkButton(text: string, url: string, actionId: string): Button {
  return { type: 'button', text: { type: 'plain_text', text, emoji: true }, url, action_id: actionId };
}
