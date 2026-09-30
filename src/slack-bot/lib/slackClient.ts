/** Slack Web API access per workspace, with clients and bot user IDs cached per team. */

import { WebClient } from '@slack/web-api';
import type { BlockKitMessage } from '@/types/slack';
import { getTeamMetadata, getTokenWithFallback } from './teamStorage';
import { logger } from './logger';

// Keyed by team ID; 'default' is the SLACK_BOT_TOKEN client.
const clients = new Map<string, WebClient>();
const botUserIds = new Map<string, string>();

const cacheKey = (teamId?: string) => teamId || 'default';

/** A client for the workspace's current token; a cached client whose token was replaced is dropped. */
export async function getSlackClient(teamId?: string): Promise<WebClient> {
  const key = cacheKey(teamId);
  const token = await getTokenWithFallback(teamId);
  let client = clients.get(key);
  if (client?.token !== token) {
    client = new WebClient(token);
    clients.set(key, client);
  }
  return client;
}

/** Forgets a team's cached client and bot user, e.g. after uninstall. */
export function clearTeamClient(teamId?: string): void {
  clients.delete(cacheKey(teamId));
  botUserIds.delete(cacheKey(teamId));
}

/** Posts to a channel, or DMs a user when `channel` is a user ID. */
export async function postMessage(channel: string, message: BlockKitMessage, teamId?: string): Promise<void> {
  const client = await getSlackClient(teamId);
  await client.chat.postMessage({ channel, blocks: message.blocks, text: message.text });
}

/** Whether `userId` is this app's bot user in the team, from install metadata or auth.test. */
export async function isBotUser(userId: string, teamId?: string): Promise<boolean> {
  const key = cacheKey(teamId);
  let botUserId = botUserIds.get(key);
  if (!botUserId) {
    // Storage errors propagate so Slack retries the event; only a failed auth.test counts as "not the bot".
    botUserId = (teamId && (await getTeamMetadata(teamId))?.botUserId) || undefined;
    if (!botUserId) {
      const client = await getSlackClient(teamId);
      try {
        botUserId = (await client.auth.test()).user_id;
      } catch (error) {
        logger.warn('Could not identify the bot user', { teamId, error });
        return false;
      }
    }
    if (botUserId) botUserIds.set(key, botUserId);
  }
  return botUserId === userId;
}
