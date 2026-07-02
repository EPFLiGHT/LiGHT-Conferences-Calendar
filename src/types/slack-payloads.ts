/**
 * Type definitions for Slack API payloads
 */

/**
 * Slash command payload (parsed from form data)
 */
export interface SlackCommandPayload {
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
  user_id: string;
  user_name: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  api_app_id: string;
  [key: string]: string;
}

/**
 * Event API payload structure
 */
export interface SlackEventPayload {
  token: string;
  team_id: string;
  api_app_id: string;
  type: 'url_verification' | 'event_callback';
  event?: SlackEvent;
  challenge?: string;
  event_id?: string;
  event_time?: number;
}

/**
 * Generic Slack event
 */
interface SlackEvent {
  type: string;
  user?: string;
  text?: string;
  ts?: string;
  channel?: string;
  event_ts?: string;
  [key: string]: unknown;
}

/**
 * Member joined channel event
 * Fired when the bot is added to a channel
 */
export interface MemberJoinedChannelEvent extends SlackEvent {
  type: 'member_joined_channel';
  user: string; // Bot user ID
  channel: string; // Channel ID
  channel_type: string; // e.g., 'C' for public channel
  team: string; // Team ID
  inviter?: string; // User who invited the bot
}

/**
 * Member left channel event
 * Fired when the bot is removed from a channel
 */
export interface MemberLeftChannelEvent extends SlackEvent {
  type: 'member_left_channel';
  user: string; // Bot user ID
  channel: string; // Channel ID
  channel_type: string;
  team: string; // Team ID
}

/**
 * Interactive components payload
 */
export interface SlackInteractionPayload {
  type: 'block_actions' | 'view_submission' | 'view_closed' | 'shortcut';
  user: {
    id: string;
    username: string;
    name: string;
    team_id: string;
  };
  team: {
    id: string;
    domain: string;
  };
  api_app_id: string;
  token: string;
  trigger_id?: string;
  response_url?: string;
  actions?: SlackAction[];
  view?: SlackView;
  container?: unknown;
  [key: string]: unknown;
}

/**
 * Slack action (button, select menu, etc.)
 */
interface SlackAction {
  type: string;
  action_id: string;
  block_id: string;
  value?: string;
  selected_option?: {
    text: { type: string; text: string };
    value: string;
  };
  action_ts: string;
  [key: string]: unknown;
}

/**
 * Slack modal view
 */
interface SlackView {
  id: string;
  team_id: string;
  type: 'modal' | 'home';
  callback_id: string;
  state: {
    values: Record<string, Record<string, unknown>>;
  };
  hash: string;
  [key: string]: unknown;
}
