/** Per-user DM reminder opt-in, stored in Redis. */

import type { UserPreferences } from '@/types/slack';
import { kvKeys } from './kvKeys';
import { recordStore } from './records';

const users = recordStore<UserPreferences>({
  key: kvKeys.user.record,
  index: kvKeys.idx.user,
  pick: ({ slackUserId, teamId, notificationsEnabled, createdAt, updatedAt }) => ({
    slackUserId,
    teamId,
    notificationsEnabled,
    createdAt,
    updatedAt,
  }),
});

export function getUserPreferences(userId: string): Promise<UserPreferences | null> {
  return users.get(userId);
}

/** Preferences of a user who never subscribed. */
export function defaultPreferences(userId: string): UserPreferences {
  const now = new Date().toISOString();
  return { slackUserId: userId, notificationsEnabled: false, createdAt: now, updatedAt: now };
}

async function updateUserPreferences(
  userId: string,
  updates: Partial<Pick<UserPreferences, 'teamId' | 'notificationsEnabled'>>
): Promise<UserPreferences> {
  const existing = (await users.get(userId)) ?? defaultPreferences(userId);
  const prefs = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  await users.put(userId, prefs);
  return prefs;
}

/** Turns DMs on, sent with the token of the workspace the user enabled them from. */
export function enableNotifications(userId: string, teamId?: string): Promise<UserPreferences> {
  return updateUserPreferences(userId, { notificationsEnabled: true, ...(teamId && { teamId }) });
}

export function disableNotifications(userId: string): Promise<UserPreferences> {
  return updateUserPreferences(userId, { notificationsEnabled: false });
}

export async function getAllUsersWithNotifications(): Promise<UserPreferences[]> {
  return (await users.all()).filter((user) => user.notificationsEnabled);
}

/** Turns DMs off for every subscribed user of a workspace, keeping their records. */
export async function disableTeamUsers(teamId: string): Promise<number> {
  const teamUsers = (await getAllUsersWithNotifications()).filter((user) => user.teamId === teamId);
  const updatedAt = new Date().toISOString();
  await Promise.all(
    teamUsers.map((user) => users.put(user.slackUserId, { ...user, notificationsEnabled: false, updatedAt }))
  );
  return teamUsers.length;
}
