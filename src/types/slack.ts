/**
 * Slack Bot Type Definitions
 */

/**
 * User preferences stored in Vercel KV
 */
export interface UserPreferences {
  slackUserId: string;
  teamId?: string; // Slack workspace/team ID (for multi-workspace support)
  notificationsEnabled: boolean;
  timezone: string; // IANA timezone (from Slack profile or manually set)
  reminderDays: number[]; // Days before deadline to notify (e.g., [30, 7, 3])
  subjects: string[]; // Subscribed subjects (e.g., ['ML', 'CV', 'SEC'])
  lastNotified: string; // ISO timestamp of last notification sent
  createdAt: string; // ISO timestamp when preferences created
  updatedAt: string; // ISO timestamp when preferences last updated
}

/**
 * Channel subscription stored in Vercel KV
 * Tracks which channels should receive automated deadline reminders
 */
export interface ChannelSubscription {
  channelId: string; // Slack channel ID
  channelName: string; // Channel name (for display/debugging)
  teamId: string; // Slack workspace/team ID
  isActive: boolean; // Whether the subscription is active
  addedBy?: string; // User ID who added the bot (optional)
  subscribedAt: string; // ISO timestamp when bot was added to channel
  lastPostedAt: string | null; // ISO timestamp of last reminder posted
}

/**
 * Slack Block Kit message structure
 */
export interface BlockKitMessage {
  blocks: BlockElement[];
  text?: string; // Fallback text for notifications
  response_type?: 'ephemeral' | 'in_channel'; // Message visibility
}

/**
 * Block Kit element types. The builders in messageBuilder construct these,
 * and the slackClient send helpers accept them.
 */
export type BlockElement =
  | HeaderBlock
  | SectionBlock
  | DividerBlock
  | ActionsBlock
  | ContextBlock;

interface HeaderBlock {
  type: 'header';
  text: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
  block_id?: string;
}

interface SectionBlock {
  type: 'section';
  text?: {
    type: 'mrkdwn' | 'plain_text';
    text: string;
  };
  fields?: Array<{
    type: 'mrkdwn' | 'plain_text';
    text: string;
  }>;
  accessory?: BlockAccessory;
  block_id?: string;
}

interface DividerBlock {
  type: 'divider';
  block_id?: string;
}

interface ActionsBlock {
  type: 'actions';
  elements: Array<ButtonElement | SelectMenuElement>;
  block_id?: string;
}

interface ContextBlock {
  type: 'context';
  elements: Array<{
    type: 'mrkdwn' | 'plain_text' | 'image';
    text?: string;
    image_url?: string;
    alt_text?: string;
  }>;
  block_id?: string;
}

export interface ButtonElement {
  type: 'button';
  text: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
  action_id?: string; // Optional: Slack auto-generates one for link buttons
  url?: string; // For link buttons
  value?: string; // For action buttons
  style?: 'primary' | 'danger';
}

interface SelectMenuElement {
  type: 'static_select' | 'multi_static_select';
  placeholder: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
  action_id: string;
  options: Array<{
    text: {
      type: 'plain_text';
      text: string;
      emoji?: boolean;
    };
    value: string;
  }>;
}

type BlockAccessory = ButtonElement | SelectMenuElement;
