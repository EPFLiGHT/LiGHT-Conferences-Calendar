import { unsubscribeTeamChannels } from './channelSubscriptions';
import { disableTeamUsers } from './userPreferences';
import { removeTeamData } from './teamStorage';
import { clearTeamClient } from './slackClient';
import { logger } from './logger';

/**
 * Forgets an uninstalled or revoked workspace: deletes token, metadata and channels, turns its users' DMs off
 * (records kept, per the privacy page). The token goes last so a partial purge is retried on the next failure.
 */
export async function purgeTeam(teamId: string): Promise<void> {
  const [channels, users] = await Promise.all([unsubscribeTeamChannels(teamId), disableTeamUsers(teamId)]);
  await removeTeamData(teamId);
  clearTeamClient(teamId);
  logger.info('Workspace purged', { teamId, channels, users });
}
