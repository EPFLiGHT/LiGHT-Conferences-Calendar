/**
 * Slack Bot Configuration Constants
 */

export const NOTIFICATION_CONFIG = {
  DEFAULT_REMINDER_DAYS: [30, 7, 3],
  DEFAULT_TIMEZONE: 'UTC',
  MAX_CONFERENCES_PER_MESSAGE: 10,
  CACHE_TTL_SECONDS: 300, // 5 minutes
} as const;

export const COMMAND_DESCRIPTIONS = {
  '/conf-upcoming': 'Show upcoming conference deadlines',
  '/conf-search <query>': 'Search conferences by name',
  '/conf-subject <code>': 'Filter conferences by subject (ML, CV, NLP, SEC, etc.)',
  '/conf-info <id-or-name>': 'Get detailed information about a specific conference',
  '/conf-subscribe': 'Enable deadline notifications (DMs)',
  '/conf-unsubscribe': 'Disable deadline notifications',
  '/conf-settings': 'View your notification settings',
  '/conf-help': 'Show all available commands',
} as const;

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
