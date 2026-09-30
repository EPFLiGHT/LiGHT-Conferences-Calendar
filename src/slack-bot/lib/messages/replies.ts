/** Replies to slash commands and buttons. */

import type { Conference, DeadlineInfo } from '@/types/conference';
import type { BlockKitMessage, UserPreferences } from '@/types/slack';
import { getDaysUntilDeadline } from '@/utils/conferenceQueries';
import { COMMANDS, NOTIFICATION_CONFIG, commandUsage } from '../../config/constants';
import { cardList } from './cards';
import { context, divider, header, plural, section } from './blocks';

/** Deadline cards under a caller-chosen title, e.g. search or subject results. */
export function buildDeadlineList(
  title: string,
  subtitle: string,
  deadlines: Array<{ conference: Conference; deadline: DeadlineInfo }>
): BlockKitMessage {
  const intro = [header(title), context(subtitle), divider];

  if (deadlines.length === 0) {
    return {
      blocks: [...intro, section('✨ No upcoming deadlines found. Check back later!')],
      text: `${title}: no upcoming deadlines`,
    };
  }

  const cards = cardList(
    deadlines.map(({ conference, deadline }) => ({
      kind: 'deadline' as const,
      conference,
      deadline,
      daysLeft: getDaysUntilDeadline(deadline),
    }))
  );
  return { blocks: [...intro, ...cards], text: `${title}: ${plural(deadlines.length, 'upcoming deadline')}` };
}

export function buildHelpMessage(): BlockKitMessage {
  const commandLine = (command: (typeof COMMANDS)[number]) =>
    section(
      `• \`${commandUsage(command)}\`\n  ${command.description}` +
        (command.example ? `\n  _Example:_ \`${command.name} ${command.example}\`` : '')
    );

  return {
    blocks: [
      header('📚 ConferenceBot Help'),
      section('Track academic conference deadlines and get notified before important dates!'),
      divider,
      section('*Available Commands:*'),
      ...COMMANDS.map(commandLine),
    ],
    text: 'ConferenceBot Help - Track academic conference deadlines',
  };
}

export function buildSettingsPanel(prefs: UserPreferences): BlockKitMessage {
  const enabled = prefs.notificationsEnabled;
  return {
    blocks: [
      header('⚙️ Your Notification Settings'),
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Status:*\n${enabled ? '✅ Enabled' : '❌ Disabled'}` },
          { type: 'mrkdwn', text: `*Reminder Days:*\n📆 ${reminderDaysText()} days before` },
        ],
      },
      divider,
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: enabled ? 'Disable Notifications' : 'Enable Notifications', emoji: true },
            action_id: enabled ? 'disable_notifications' : 'enable_notifications',
            ...(!enabled && { style: 'primary' as const }),
          },
        ],
      },
    ],
    text: `Notifications: ${enabled ? 'Enabled' : 'Disabled'}`,
  };
}

export function reminderDaysText(): string {
  return NOTIFICATION_CONFIG.REMINDER_DAYS.join(', ');
}

export function buildErrorMessage(error: string): BlockKitMessage {
  return { blocks: [section(`❌ *Error:* ${error}`)], text: `Error: ${error}` };
}

export function buildSuccessMessage(message: string): BlockKitMessage {
  return { blocks: [section(`✅ ${message}`)], text: message };
}
