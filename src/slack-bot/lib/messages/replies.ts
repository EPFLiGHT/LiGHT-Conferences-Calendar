/** Replies to slash commands and buttons. */

import type { Button } from '@slack/web-api';
import type { BlockKitMessage, UserPreferences } from '@/types/slack';
import { COMMANDS, NOTIFICATION_CONFIG, commandUsage } from '../../config/constants';
import { cardList, type ConferenceCardItem } from './cards';
import { context, divider, header, plural, section } from './blocks';

/** Cards under a caller-chosen title, e.g. search or subject results. */
export function buildResultList(title: string, subtitle: string, items: ConferenceCardItem[]): BlockKitMessage {
  const intro = [header(title), context(subtitle), divider];

  if (items.length === 0) {
    return {
      blocks: [...intro, section('✨ Nothing upcoming: no open deadlines or future events. Check back later!')],
      text: `${title}: nothing upcoming`,
    };
  }

  return { blocks: [...intro, ...cardList(items)], text: `${title}: ${plural(items.length, 'upcoming result')}` };
}

export function buildHelpMessage(): BlockKitMessage {
  const commandLine = (command: (typeof COMMANDS)[number]) =>
    section(
      `• \`${commandUsage(command)}\`\n  ${command.description}` +
        (command.example ? `\n  _Example:_ \`${command.name} ${command.example}\`` : '')
    );

  return {
    blocks: [
      header('📚 LiGHT Events Radar Help'),
      section('Track conference and event deadlines and get notified before important dates!'),
      divider,
      section('*Available Commands:*'),
      ...COMMANDS.map(commandLine),
    ],
    text: 'LiGHT Events Radar Help - Track conference and event deadlines',
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
        elements: [remindersButton(enabled, enabled ? 'Disable Notifications' : 'Enable Notifications')],
      },
    ],
    text: `Notifications: ${enabled ? 'Enabled' : 'Disabled'}`,
  };
}

/** Flips DM reminders; the interactions route handles both action IDs. */
export function remindersButton(enabled: boolean, text: string): Button {
  return {
    type: 'button',
    text: { type: 'plain_text', text, emoji: true },
    action_id: enabled ? 'disable_notifications' : 'enable_notifications',
    ...(!enabled && { style: 'primary' as const }),
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
