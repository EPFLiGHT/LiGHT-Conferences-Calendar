/** Slack bot records stored in Redis, and the message shape every builder returns. */

import type { KnownBlock } from '@slack/web-api';

export interface BlockKitMessage {
  blocks: KnownBlock[];
  /** Notification and screen-reader fallback. */
  text: string;
}

export interface UserPreferences {
  slackUserId: string;
  /** Workspace whose token sends this user's DMs; absent on records from single-workspace installs. */
  teamId?: string;
  notificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A channel the bot was added to, which gets the daily reminder post. */
export interface ChannelSubscription {
  channelId: string;
  channelName: string;
  teamId: string;
  addedBy?: string;
  subscribedAt: string;
}

export interface TeamMetadata {
  teamName: string;
  botUserId: string;
  installedAt: string;
  scope: string;
  appId: string;
}
