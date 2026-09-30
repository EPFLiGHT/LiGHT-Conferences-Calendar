import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fakeKv, resetKv } from '@/slack-bot/testing/fakeKv';

vi.mock('./kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));

import { enableNotifications, getUserPreferences, getAllUsersWithNotifications } from './userPreferences';
import { kvKeys } from './kvKeys';

const LEGACY_RECORD = {
  slackUserId: 'U1',
  teamId: 'T1',
  notificationsEnabled: true,
  timezone: 'UTC',
  reminderDays: [30, 7, 3],
  subjects: [],
  lastNotified: '2026-01-01T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

describe('user preferences', () => {
  beforeEach(() => {
    resetKv();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('loads records that still carry retired fields, keeping only the current ones', async () => {
    await fakeKv.set(kvKeys.user.record('U1'), LEGACY_RECORD);
    await fakeKv.sadd(kvKeys.idx.user, 'U1');

    const expected = {
      slackUserId: 'U1',
      teamId: 'T1',
      notificationsEnabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    expect(await getUserPreferences('U1')).toEqual(expected);
    expect(await getAllUsersWithNotifications()).toEqual([expected]);
  });

  it('never overwrites a record after a failed read', async () => {
    await fakeKv.set(kvKeys.user.record('U1'), LEGACY_RECORD);
    vi.spyOn(fakeKv, 'get').mockRejectedValueOnce(new Error('redis down'));
    const set = vi.spyOn(fakeKv, 'set');

    await expect(enableNotifications('U1', 'T2')).rejects.toThrow('redis down');
    expect(set).not.toHaveBeenCalled();
  });
});
