/**
 * Slack Web API Client
 * Supports multi-workspace installations with OAuth
 */

import { WebClient } from '@slack/web-api';
import type { BlockElement } from '@/types/slack';
import { getTokenWithFallback } from './teamStorage';

// Cache of WebClient instances per team
const clientCache = new Map<string, WebClient>();

/**
 * Get or create a Slack Web API client for a specific team
 *
 * @param teamId - The Slack team/workspace ID (optional, falls back to env var)
 * @returns WebClient instance configured for the team
 */
export async function getSlackClient(teamId?: string): Promise<WebClient> {
  // Use a cache key based on team ID or 'default' for env var mode
  const cacheKey = teamId || 'default';

  // Return cached client if available
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  // Get token (OAuth or fallback to env var)
  const token = await getTokenWithFallback(teamId);

  // Create new client
  const client = new WebClient(token);
  clientCache.set(cacheKey, client);

  return client;
}

/**
 * Drop the cached client for a single team (call after token rotation/uninstall).
 */
export function clearTeamClient(teamId?: string): void {
  clientCache.delete(teamId || 'default');
}

/**
 * Post a message to a Slack channel
 *
 * @param channelId - The channel ID to post to
 * @param blocks - Block Kit blocks for the message
 * @param text - Fallback text for notifications
 * @param teamId - The team ID (for multi-workspace support)
 */
export async function postToChannel(
  channelId: string,
  blocks: BlockElement[],
  text: string,
  teamId?: string
): Promise<void> {
  const client = await getSlackClient(teamId);

  await client.chat.postMessage({
    channel: channelId,
    blocks,
    text, // Fallback text for notifications
  });
}

/**
 * Send a direct message to a Slack user
 *
 * @param userId - The user ID to send DM to
 * @param blocks - Block Kit blocks for the message
 * @param text - Fallback text for notifications
 * @param teamId - The team ID (for multi-workspace support)
 */
export async function sendDM(
  userId: string,
  blocks: BlockElement[],
  text?: string,
  teamId?: string
): Promise<void> {
  const client = await getSlackClient(teamId);

  await client.chat.postMessage({
    channel: userId, // For DMs, the channel is the user ID
    blocks,
    text: text || 'Conference deadline notification', // Fallback text for notifications
  });
}
