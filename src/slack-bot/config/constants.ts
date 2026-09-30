/** Slack bot settings and the slash command catalog. Pure data, so client pages can import it. */

export const NOTIFICATION_CONFIG = {
  /** Days before a deadline or event start that DM reminders go out (channels: CHANNEL_REMINDER_DAYS). */
  REMINDER_DAYS: [30, 7, 3],
  MAX_CONFERENCES_PER_MESSAGE: 10,
  CACHE_TTL_SECONDS: 300,
} as const;

interface CommandInfo {
  name: string;
  args?: string;
  description: string;
  /** Sample arguments shown in /conf-help. */
  example?: string;
}

const COMMAND_LIST = [
  { name: '/conf-upcoming', description: 'Show upcoming conference deadlines' },
  { name: '/conf-search', args: '<query>', description: 'Search conferences by name', example: 'CVPR' },
  {
    name: '/conf-subject',
    args: '<code>',
    description: 'Filter conferences by subject (ML, CV, NLP, SEC, etc.)',
    example: 'ML',
  },
  {
    name: '/conf-info',
    args: '<id-or-name>',
    description: 'Get detailed information about a specific conference',
    example: 'NeurIPS',
  },
  { name: '/conf-subscribe', description: 'Enable deadline notifications (DMs)' },
  { name: '/conf-unsubscribe', description: 'Disable deadline notifications' },
  { name: '/conf-settings', description: 'View your notification settings' },
  { name: '/conf-help', description: 'Show all available commands' },
] as const satisfies readonly CommandInfo[];

/** Every slash command in help order; commands/index.ts binds a handler to each name. */
export const COMMANDS: readonly CommandInfo[] = COMMAND_LIST;

export type CommandName = (typeof COMMAND_LIST)[number]['name'];

export const commandUsage = ({ name, args }: CommandInfo): string => (args ? `${name} ${args}` : name);

/** Usage to description, for the install page. */
export const COMMAND_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  COMMANDS.map((command) => [commandUsage(command), command.description])
);

export const URGENCY_CONFIG = {
  CRITICAL_DAYS: 3,
  URGENT_DAYS: 7,
  UPCOMING_DAYS: 30,
} as const;

export const URGENCY_EMOJIS = {
  critical: '🔴',
  urgent: '🟡',
  upcoming: '🟢',
} as const;
