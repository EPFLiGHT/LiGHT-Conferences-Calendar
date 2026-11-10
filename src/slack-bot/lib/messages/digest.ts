/** One digest layout for the daily channel post, the daily DM and /conf-upcoming. */

import type { KnownBlock } from '@slack/web-api';
import type { BlockKitMessage } from '@/types/slack';
import { NOTIFICATION_CONFIG } from '../../config/constants';
import { cardList, groupDeadlineItems, type ConferenceCardItem, type DeadlineItem, type EventStartItem } from './cards';
import { context, divider, header, plural, section } from './blocks';

export interface DigestStyle {
  /** Notification text, and the header when nothing is coming up. */
  title: string;
  footer: string;
}

export const CHANNEL_DIGEST: DigestStyle = {
  title: '📅 Conference Update',
  footer: '💡 New here? Type `/conf-help`. Want reminders in your DMs? `/conf-subscribe`',
};

export const DM_DIGEST: DigestStyle = {
  title: '🔔 Your deadline reminder',
  footer: '💡 View your settings with `/conf-settings` · stop with `/conf-unsubscribe`',
};

const SLACK_MAX_BLOCKS = 50;

type DigestParams = DigestStyle & {
  deadlines: DeadlineItem[];
  eventStarts: EventStartItem[];
  date: Date;
  maxItems?: number;
};

/** The digest, with fewer cards per section when the full list would exceed Slack's block limit. */
export function buildDigest(params: DigestParams): BlockKitMessage {
  let maxItems = params.maxItems ?? NOTIFICATION_CONFIG.MAX_CONFERENCES_PER_MESSAGE;
  let message = renderDigest(params, maxItems);
  while (message.blocks.length > SLACK_MAX_BLOCKS && maxItems > 1) {
    message = renderDigest(params, --maxItems);
  }
  return message;
}

function renderDigest(params: DigestParams, maxItems: number): BlockKitMessage {
  const { title, footer, deadlines, eventStarts, date } = params;
  const dateLine = context(formatDigestDate(date));

  // Each section opens with its own header; the date sits under the first one.
  const digestSection = (heading: string, items: ConferenceCardItem[], first: boolean): KnownBlock[] => [
    header(heading),
    ...(first ? [dateLine, divider] : []),
    ...cardList(items.slice(0, maxItems)),
    ...(items.length > maxItems
      ? [context(`_+ ${items.length - maxItems} more. Type \`/conf-upcoming\` to see them all_`)]
      : []),
  ];

  const sections: Array<[string, ConferenceCardItem[]]> = [];
  if (deadlines.length > 0) {
    // Cards (one per event) are capped; the summary below still counts deadlines.
    sections.push(['⏳ Deadlines approaching', groupDeadlineItems(deadlines).map((card) => ({ kind: 'deadline' as const, ...card }))]);
  }
  if (eventStarts.length > 0) {
    sections.push(['🎟️ Starting soon', eventStarts.map((e) => ({ kind: 'event' as const, ...e }))]);
  }
  const body: KnownBlock[] =
    sections.length > 0
      ? sections.flatMap(([heading, items], i) => [...(i === 0 ? [] : [divider]), ...digestSection(heading, items, i === 0)])
      : [header(title), dateLine, divider, section('✨ Nothing coming up right now. Check back later!')];

  const summary = [
    deadlines.length > 0 && plural(deadlines.length, 'deadline'),
    eventStarts.length > 0 && `${plural(eventStarts.length, 'event')} starting soon`,
  ].filter(Boolean);

  return {
    blocks: [...body, divider, context(footer)],
    text: summary.length > 0 ? `${title}: ${summary.join(' • ')}` : title,
  };
}

function formatDigestDate(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}
