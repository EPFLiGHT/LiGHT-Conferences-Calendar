/** Slack request payloads, as parsed by the Slack middleware. */

/** Slash command form fields. */
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

interface SlackEvent {
  type: string;
  user?: string;
  channel?: string;
  [key: string]: unknown;
}

/** Someone joined a channel; the bot itself when it is added. */
export interface MemberJoinedChannelEvent extends SlackEvent {
  type: 'member_joined_channel';
  user: string;
  channel: string;
  inviter?: string;
}

/** Someone left a channel; the bot itself when it is removed. */
export interface MemberLeftChannelEvent extends SlackEvent {
  type: 'member_left_channel';
  user: string;
  channel: string;
}

export interface AppHomeOpenedEvent extends SlackEvent {
  type: 'app_home_opened';
  user: string;
  tab: 'home' | 'messages';
}

export interface SlackInteractionPayload {
  type: string;
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
  /** The view a button was clicked in; Home tab clicks carry no `response_url`. */
  view?: { type: string };
  actions?: SlackAction[];
  [key: string]: unknown;
}

interface SlackAction {
  type: string;
  action_id: string;
  block_id: string;
  value?: string;
  action_ts: string;
  [key: string]: unknown;
}
