/**
 * User Preferences Management
 * Uses Vercel KV (Redis) for storing user settings
 */

// @ts-ignore - @vercel/kv will be installed when deploying to Vercel
import { kv } from '@vercel/kv';
import type { UserPreferences } from '@/types/slack';
import { logger } from '../utils/logger';
import { NOTIFICATION_CONFIG } from '../config/constants';
import { kvKeys } from './kvKeys';

const USERS_LIST_KEY = kvKeys.idx.user;

/**
 * Get user preferences
 */
export async function getUserPreferences(
  userId: string
): Promise<UserPreferences | null> {
  try {
    const key = kvKeys.user.record(userId);
    const prefs = await kv.get<UserPreferences>(key);
    return prefs;
  } catch (error) {
    logger.error('Failed to get user preferences', error, { userId });
    return null;
  }
}

/**
 * Create default user preferences
 */
function createDefaultPreferences(userId: string): UserPreferences {
  const now = new Date().toISOString();
  return {
    slackUserId: userId,
    notificationsEnabled: false,
    timezone: NOTIFICATION_CONFIG.DEFAULT_TIMEZONE,
    reminderDays: [...NOTIFICATION_CONFIG.DEFAULT_REMINDER_DAYS],
    subjects: [],
    lastNotified: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update user preferences (creates if doesn't exist)
 */
export async function updateUserPreferences(
  userId: string,
  updates: Partial<Omit<UserPreferences, 'slackUserId' | 'createdAt'>>
): Promise<UserPreferences> {
  try {
    const key = kvKeys.user.record(userId);
    const existing = await getUserPreferences(userId);

    const prefs: UserPreferences = existing
      ? {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString(),
        }
      : {
          ...createDefaultPreferences(userId),
          ...updates,
        };

    await kv.set(key, prefs);

    // Add to users list for bulk operations
    await kv.sadd(USERS_LIST_KEY, userId);

    logger.info('User preferences updated', { userId, updates });
    return prefs;
  } catch (error) {
    logger.error('Failed to update user preferences', error, { userId });
    throw error;
  }
}

/**
 * Enable notifications for user
 * Resets reminderDays to defaults if user is enabling for the first time or re-enabling
 */
export async function enableNotifications(
  userId: string,
  teamId?: string
): Promise<UserPreferences> {
  const existing = await getUserPreferences(userId);

  // If user is enabling notifications (not already enabled), reset reminderDays to defaults
  const updates: Partial<Omit<UserPreferences, 'slackUserId' | 'createdAt'>> = {
    notificationsEnabled: true
  };

  // Store teamId for multi-workspace support
  if (teamId) {
    updates.teamId = teamId;
  }

  // Reset reminderDays to defaults if user was previously disabled or is new
  if (!existing || !existing.notificationsEnabled) {
    updates.reminderDays = [...NOTIFICATION_CONFIG.DEFAULT_REMINDER_DAYS];
  }

  return updateUserPreferences(userId, updates);
}

/**
 * Disable notifications for user
 */
export async function disableNotifications(userId: string): Promise<UserPreferences> {
  return updateUserPreferences(userId, { notificationsEnabled: false });
}

/**
 * Get all users with notifications enabled
 */
export async function getAllUsersWithNotifications(): Promise<UserPreferences[]> {
  try {
    const userIds = await kv.smembers(USERS_LIST_KEY);
    if (!userIds || userIds.length === 0) return [];

    const users = await Promise.all(
      userIds.map(async (userId: string) => {
        return kv.get<UserPreferences>(kvKeys.user.record(userId));
      })
    );

    return users.filter(
      (user: UserPreferences | null): user is UserPreferences =>
        user !== null && user.notificationsEnabled
    );
  } catch (error) {
    logger.error('Failed to get users with notifications', error);
    return [];
  }
}
