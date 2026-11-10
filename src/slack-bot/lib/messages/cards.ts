/** The conference card every list, digest and /conf-info reply is built from. */

import type { Button, KnownBlock } from '@slack/web-api';
import type { DateTime } from 'luxon';
import type { Conference, DeadlineInfo } from '@/types/conference';
import type { BlockKitMessage } from '@/types/slack';
import { getDaysUntilDeadline } from '@/utils/conferenceQueries';
import { getCardDeadlines, getNoDeadlineLabel } from '@/utils/parser';
import { DEADLINE_GROUP_EMOJIS } from '@/constants/deadlineTypes';
import { SUBJECT_LABELS, SUBJECT_EMOJIS } from '@/constants/subjects';
import { URGENCY_EMOJIS, URGENCY_CONFIG } from '../../config/constants';
import { appUrl } from '../appUrl';
import { context, divider, plural, section } from './blocks';

export type DeadlineItem = { conference: Conference; deadline: DeadlineInfo; daysLeft: number };
/** One event's deadlines in one card. */
export type DeadlineCardItem = {
  conference: Conference;
  deadlines: Array<{ deadline: DeadlineInfo; daysLeft: number }>;
};
export type EventStartItem = { conference: Conference; start: DateTime; daysLeft: number };

export type ConferenceCardItem = ({ kind: 'deadline' } & DeadlineCardItem) | ({ kind: 'event' } & EventStartItem);

/** One card per conference, in first-appearance order, each with its deadlines in due order. */
export function groupDeadlineItems(items: DeadlineItem[]): DeadlineCardItem[] {
  const cards = new Map<string, DeadlineCardItem>();
  for (const { conference, deadline, daysLeft } of items) {
    const card = cards.get(conference.id) ?? { conference, deadlines: [] };
    card.deadlines.push({ deadline, daysLeft });
    cards.set(conference.id, card);
  }
  for (const card of cards.values()) {
    card.deadlines.sort((x, y) => x.deadline.datetime.toMillis() - y.deadline.datetime.toMillis());
  }
  return [...cards.values()];
}

export function buildConferenceCard(item: ConferenceCardItem): KnownBlock[] {
  const { conference } = item;
  const daysLeft = item.kind === 'deadline' ? Math.min(...item.deadlines.map((d) => d.daysLeft)) : item.daysLeft;
  const lines = [`${urgencyEmoji(daysLeft)} *${conference.title} ${conference.year}*  ${subjectTags(conference.sub)}`];

  if (item.kind === 'deadline') {
    // The conference's own zone, as its website states it; local would be the server's (UTC).
    for (const { deadline, daysLeft: left } of item.deadlines) {
      const { datetime } = deadline;
      lines.push(
        `${DEADLINE_GROUP_EMOJIS[deadline.group]} ${deadline.label}: *${datetime.toFormat('MMM d, yyyy')}* (${datetime.zoneName}) · ⏰ ${formatDeadlineUrgency(left)}`
      );
    }
  } else {
    if (conference.place) lines.push(`📍 ${conference.place}`);
    lines.push(`📆 Starts *${item.start.toFormat('MMM d, yyyy')}* · ${formatEventCountdown(item.daysLeft)}`);
  }

  return [section(lines.join('\n')), { type: 'actions', elements: cardButtons(conference) }];
}

/** Cards separated by dividers. */
export function cardList(items: ConferenceCardItem[]): KnownBlock[] {
  return items.flatMap((item, i) => [...(i === 0 ? [] : [divider]), ...buildConferenceCard(item)]);
}

/** /conf-info reply: the card (every upcoming deadline, else the latest passed one) plus full name, place and note. */
export function buildConferenceDetails(conference: Conference): BlockKitMessage {
  const details = context(
    [conference.full_name, conference.place && `📍 ${conference.place}`, conference.note && `ℹ️ ${conference.note}`]
      .filter(Boolean)
      .join('  ·  ')
  );
  const name = `${conference.title} ${conference.year}`;
  const { shown } = getCardDeadlines(conference, Infinity);

  if (shown.length === 0) {
    const noDeadline = getNoDeadlineLabel(conference);
    return { blocks: [section(`📅 *${name}*\n_${noDeadline}_`), details], text: `${name} - ${noDeadline}` };
  }

  const deadlines = shown.map((deadline) => ({ deadline, daysLeft: getDaysUntilDeadline(deadline) }));
  const card = buildConferenceCard({ kind: 'deadline', conference, deadlines });
  return { blocks: [...card, details], text: `${name} - ${shown.map((d) => d.label).join(', ')}` };
}

function cardButtons(conference: Conference): Button[] {
  const button = (text: string, url: string, extra?: Partial<Button>): Button => ({
    type: 'button',
    text: { type: 'plain_text', text, emoji: true },
    url,
    ...extra,
  });

  return [
    ...(conference.link ? [button('🌐 Website', conference.link, { style: 'primary' })] : []),
    // Must not start with `calendar_`: the interactions route replies to those with a message.
    button('📅 Add to Calendar', `${appUrl()}/api/calendar/${conference.id}`, { action_id: `ics_${conference.id}` }),
    ...(conference.paperslink ? [button('📄 Papers', conference.paperslink)] : []),
  ];
}

function subjectTags(subjects: string[]): string {
  return subjects.map((s) => `${SUBJECT_EMOJIS[s] || '📌'} ${SUBJECT_LABELS[s] || s}`).join(', ');
}

export function urgencyEmoji(daysLeft: number): string {
  if (daysLeft <= URGENCY_CONFIG.CRITICAL_DAYS) return URGENCY_EMOJIS.critical;
  if (daysLeft <= URGENCY_CONFIG.URGENT_DAYS) return URGENCY_EMOJIS.urgent;
  if (daysLeft <= URGENCY_CONFIG.UPCOMING_DAYS) return URGENCY_EMOJIS.upcoming;
  return '📅';
}

/** Days as words; callers handle today and the past. */
function formatTimeRemaining(days: number): string {
  if (days < 7) return plural(days, 'day');
  if (days < 30) return plural(Math.floor(days / 7), 'week');
  return plural(Math.floor(days / 30), 'month');
}

export function formatDeadlineUrgency(daysLeft: number): string {
  if (daysLeft < 0) return 'Expired';
  if (daysLeft === 0) return 'Due today!';
  return `${formatTimeRemaining(daysLeft)} left`;
}

export function formatEventCountdown(daysLeft: number): string {
  if (daysLeft <= 0) return 'starting today';
  return `in ${formatTimeRemaining(daysLeft)}`;
}
