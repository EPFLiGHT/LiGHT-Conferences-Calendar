/** Per-workspace bot tokens and install metadata from the OAuth flow, stored in Redis. */

import type { TeamMetadata } from '@/types/slack';
import { kv } from './kv';
import { kvKeys } from './kvKeys';
import { logger } from './logger';

export async function storeTeamToken(teamId: string, botToken: string): Promise<void> {
  await kv.set(kvKeys.team.token(teamId), botToken);
}

export async function storeTeamMetadata(teamId: string, metadata: TeamMetadata): Promise<void> {
  await kv.set(kvKeys.team.metadata(teamId), metadata);
}

export function getTeamToken(teamId: string): Promise<string | null> {
  return kv.get<string>(kvKeys.team.token(teamId));
}

export function getTeamMetadata(teamId: string): Promise<TeamMetadata | null> {
  // The client JSON-decodes on read, including entries stored as JSON strings
  return kv.get<TeamMetadata>(kvKeys.team.metadata(teamId));
}

export async function removeTeamData(teamId: string): Promise<void> {
  await kv.del(kvKeys.team.token(teamId), kvKeys.team.metadata(teamId));
}

/** The workspace's OAuth token, else SLACK_BOT_TOKEN for single-workspace installs. */
export async function getTokenWithFallback(teamId?: string): Promise<string> {
  if (teamId) {
    const token = await getTeamToken(teamId);
    if (token) return token;
    logger.warn('No stored token for team, using SLACK_BOT_TOKEN', { teamId });
  }

  const envToken = process.env.SLACK_BOT_TOKEN;
  if (!envToken) {
    throw new Error('No Slack token available. Either configure SLACK_BOT_TOKEN or complete OAuth installation.');
  }
  return envToken;
}
