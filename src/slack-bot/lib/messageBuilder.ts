/**
 * Slack Block Kit Message Builder
 * Creates rich formatted messages for Slack
 */

import type { Conference, DeadlineInfo } from '@/types/conference';
import type { BlockKitMessage, UserPreferences } from '@/types/slack';
import { getDaysUntilDeadline } from '@/utils/conferenceQueries';
import { SUBJECT_LABELS, SUBJECT_EMOJIS } from '@/constants/subjects';
import { DateTime } from 'luxon';
import {
  URGENCY_EMOJIS,
  URGENCY_CONFIG,
  COMMAND_DESCRIPTIONS,
  NOTIFICATION_CONFIG,
} from '../config/constants';

export type ConferenceCardItem =
  | { kind: 'deadline'; conference: Conference; deadline: DeadlineInfo; daysLeft: number }
  | { kind: 'event'; conference: Conference; start: DateTime; daysLeft: number };

/**
 * Single source of truth for a conference "card". Used by channel digests and DMs
 * so the layout can never drift between them.
 */
export function buildConferenceItemBlocks(item: ConferenceCardItem): any[] {
  const { conference } = item;
  const urgencyEmoji = getUrgencyEmoji(item.daysLeft);
  const subjects = Array.isArray(conference.sub) ? conference.sub : [conference.sub];
  const subjectTag = subjects
    .map((s) => `${SUBJECT_EMOJIS[s] || '📌'} ${SUBJECT_LABELS[s] || s}`)
    .join(', ');

  const lines: string[] = [`${urgencyEmoji} *${conference.title} ${conference.year}*  ${subjectTag}`];

  if (item.kind === 'deadline') {
    lines.push(`📝 ${item.deadline.label}: *${item.deadline.localDatetime.toFormat('MMM d, yyyy')}*`);
    lines.push(`⏰ ${formatDeadlineUrgency(item.daysLeft)}`);
  } else {
    if (conference.place) lines.push(`📍 ${conference.place}`);
    lines.push(`📆 Starts *${item.start.toFormat('MMM d, yyyy')}* · ${formatEventCountdown(item.daysLeft)}`);
  }

  const blocks: any[] = [
    { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
  ];

  const actionElements: any[] = [];
  if (conference.link) {
    actionElements.push({
      type: 'button',
      text: { type: 'plain_text', text: '🌐 Website', emoji: true },
      url: conference.link,
      style: 'primary',
    });
  }
  actionElements.push({
    type: 'button',
    text: { type: 'plain_text', text: '📅 Add to Calendar', emoji: true },
    action_id: `calendar_${conference.id}`,
    value: conference.id,
  });
  if (conference.paperslink) {
    actionElements.push({
      type: 'button',
      text: { type: 'plain_text', text: '📄 Papers', emoji: true },
      url: conference.paperslink,
    });
  }
  blocks.push({ type: 'actions', elements: actionElements });

  return blocks;
}

/**
 * Build a list of upcoming deadlines
 */
export function buildDeadlineList(
  deadlines: Array<{ conference: Conference; deadline: DeadlineInfo }>
): BlockKitMessage {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📅 Upcoming Conference Deadlines',
        emoji: true,
      },
    },
  ];

  if (deadlines.length === 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '✨ No upcoming deadlines found. Check back later!',
      },
    });

    return { blocks, text: 'No upcoming deadlines' };
  }

  deadlines.forEach(({ conference, deadline }, index) => {
    blocks.push(
      ...buildConferenceItemBlocks({
        kind: 'deadline',
        conference,
        deadline,
        daysLeft: getDaysUntilDeadline(deadline),
      })
    );

    if (index < deadlines.length - 1) {
      blocks.push({ type: 'divider' });
    }
  });

  return {
    blocks,
    text: `${deadlines.length} upcoming deadlines`,
  };
}

/**
 * Build help message with all commands
 */
export function buildHelpMessage(): BlockKitMessage {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '📚 ConferenceBot Help',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Track academic conference deadlines and get notified before important dates!',
      },
    },
    { type: 'divider' },
  ];

  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Available Commands:*',
    },
  });

  Object.entries(COMMAND_DESCRIPTIONS).forEach(([cmd, desc]) => {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• \`${cmd}\`\n  ${desc}`,
      },
    });
  });

  blocks.push(
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Examples:*\n• `/conf-upcoming` - See next 5 deadlines\n• `/conf-search CVPR` - Find CVPR conferences\n• `/conf-subject ML` - Filter by Machine Learning\n• `/conf-subscribe` - Start receiving notifications',
      },
    }
  );

  return {
    blocks,
    text: 'ConferenceBot Help - Track academic conference deadlines',
  };
}

/**
 * Build settings panel with user preferences
 */
export function buildSettingsPanel(prefs: UserPreferences): BlockKitMessage {
  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '⚙️ Your Notification Settings',
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Status:*\n${prefs.notificationsEnabled ? '✅ Enabled' : '❌ Disabled'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Timezone:*\n🌍 ${prefs.timezone}`,
        },
        {
          type: 'mrkdwn',
          text: `*Reminder Days:*\n📆 ${prefs.reminderDays.join(', ')} days before`,
        },
        {
          type: 'mrkdwn',
          text: `*Subscribed Subjects:*\n${
            prefs.subjects.length > 0
              ? prefs.subjects.map((s) => `${SUBJECT_EMOJIS[s] || '📌'} ${SUBJECT_LABELS[s] || s}`).join(', ')
              : 'All subjects'
          }`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: prefs.notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications',
            emoji: true,
          },
          action_id: prefs.notificationsEnabled ? 'disable_notifications' : 'enable_notifications',
          style: prefs.notificationsEnabled ? undefined : 'primary',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'Edit Subjects',
            emoji: true,
          },
          action_id: 'edit_subjects',
        },
      ],
    },
  ];

  return {
    blocks,
    text: `Notifications: ${prefs.notificationsEnabled ? 'Enabled' : 'Disabled'}`,
  };
}

/**
 * Build error message
 */
export function buildErrorMessage(error: string): BlockKitMessage {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `❌ *Error:* ${error}`,
        },
      },
    ],
    text: `Error: ${error}`,
  };
}

/**
 * Build success message
 */
export function buildSuccessMessage(message: string): BlockKitMessage {
  return {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `✅ ${message}`,
        },
      },
    ],
    text: message,
  };
}

/**
 * Get urgency emoji based on days left
 */
function getUrgencyEmoji(daysLeft: number): string {
  if (daysLeft <= URGENCY_CONFIG.CRITICAL_DAYS) return URGENCY_EMOJIS.critical;
  if (daysLeft <= URGENCY_CONFIG.URGENT_DAYS) return URGENCY_EMOJIS.urgent;
  if (daysLeft <= URGENCY_CONFIG.UPCOMING_DAYS) return URGENCY_EMOJIS.upcoming;
  return '📅';
}

/**
 * Build user deadline notification message
 * Personalized notification sent to users about upcoming deadlines
 */
export function buildUserDeadlineNotification(
  deadlines: Array<{ conference: Conference; deadline: DeadlineInfo }>
): BlockKitMessage {
  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: '🔔 Your deadline reminder', emoji: true } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: 'You asked to be reminded about these' }] },
    { type: 'divider' },
  ];

  deadlines.forEach(({ conference, deadline }, index) => {
    blocks.push(
      ...buildConferenceItemBlocks({
        kind: 'deadline',
        conference,
        deadline,
        daysLeft: getDaysUntilDeadline(deadline),
      })
    );
    if (index < deadlines.length - 1) blocks.push({ type: 'divider' });
  });

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        { type: 'mrkdwn', text: '💡 Manage these with `/conf-settings` · stop with `/conf-unsubscribe`' },
      ],
    }
  );

  return {
    blocks,
    text: `Deadline reminder: ${deadlines.length} ${deadlines.length === 1 ? 'deadline' : 'deadlines'}`,
  };
}

/**
 * Build a notification listing conferences whose event start is approaching.
 * Distinct from deadline reminders - this is "the event itself is in N days".
 */
export function buildEventStartNotification(
  events: Array<{ conference: Conference; start: DateTime; daysLeft: number }>
): BlockKitMessage {
  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: '🎟️ Conferences Starting Soon', emoji: true } },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${events.length}* ${events.length === 1 ? 'conference is' : 'conferences are'} starting in the coming days:`,
      },
    },
    { type: 'divider' },
  ];

  events.forEach(({ conference, start, daysLeft }, index) => {
    blocks.push(...buildConferenceItemBlocks({ kind: 'event', conference, start, daysLeft }));
    if (index < events.length - 1) blocks.push({ type: 'divider' });
  });

  return {
    blocks,
    text: `${events.length} conference${events.length === 1 ? '' : 's'} starting soon`,
  };
}

/**
 * Format time remaining in human-readable format
 */
function formatTimeRemaining(days: number): string {
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today!';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 week' : `${weeks} weeks`;
  }
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month' : `${months} months`;
}

/**
 * Urgency text for a deadline, in plain language. Built on formatTimeRemaining.
 */
export function formatDeadlineUrgency(daysLeft: number): string {
  if (daysLeft < 0) return 'Expired';
  if (daysLeft === 0) return 'Due today!';
  return `${formatTimeRemaining(daysLeft)} left`;
}

/**
 * Countdown text for an event start, in plain language.
 */
export function formatEventCountdown(daysLeft: number): string {
  if (daysLeft <= 0) return 'starting today';
  return `in ${formatTimeRemaining(daysLeft)}`;
}

/**
 * Owns the entire daily channel post: unified title, two optional sections built
 * from the shared card, overflow handling, and a single footer.
 */
export function buildChannelDigest(params: {
  deadlines: Array<{ conference: Conference; deadline: DeadlineInfo; daysLeft: number }>;
  eventStarts: Array<{ conference: Conference; start: DateTime; daysLeft: number }>;
  date: Date;
  maxItems?: number;
}): BlockKitMessage {
  const { deadlines, eventStarts, date } = params;
  const maxItems = params.maxItems ?? NOTIFICATION_CONFIG.MAX_CONFERENCES_PER_MESSAGE;

  const headerDate = date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: '📅 Conference Update', emoji: true } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: headerDate }] },
    { type: 'divider' },
  ];

  const overflowLine = (extra: number) => ({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `_+ ${extra} more — type \`/conf-upcoming\` to see them all_` },
    ],
  });

  if (deadlines.length > 0) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*🔴 Deadlines approaching*' } });
    const shown = deadlines.slice(0, maxItems);
    shown.forEach(({ conference, deadline, daysLeft }, i) => {
      blocks.push(...buildConferenceItemBlocks({ kind: 'deadline', conference, deadline, daysLeft }));
      if (i < shown.length - 1) blocks.push({ type: 'divider' });
    });
    if (deadlines.length > maxItems) blocks.push(overflowLine(deadlines.length - maxItems));
  }

  if (eventStarts.length > 0) {
    if (deadlines.length > 0) blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*🎟️ Starting soon*' } });
    const shown = eventStarts.slice(0, maxItems);
    shown.forEach(({ conference, start, daysLeft }, i) => {
      blocks.push(...buildConferenceItemBlocks({ kind: 'event', conference, start, daysLeft }));
      if (i < shown.length - 1) blocks.push({ type: 'divider' });
    });
    if (eventStarts.length > maxItems) blocks.push(overflowLine(eventStarts.length - maxItems));
  }

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '💡 New here? Type `/conf-help`. Want reminders in your DMs? `/conf-subscribe`',
        },
      ],
    }
  );

  const parts: string[] = [];
  if (deadlines.length > 0) parts.push(`${deadlines.length} ${deadlines.length === 1 ? 'deadline' : 'deadlines'}`);
  if (eventStarts.length > 0) parts.push(`${eventStarts.length} ${eventStarts.length === 1 ? 'event' : 'events'} starting soon`);

  return { blocks, text: `Conference Update: ${parts.join(' • ')}` };
}
