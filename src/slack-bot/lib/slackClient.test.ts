import { describe, it, expect, vi } from 'vitest';

vi.mock('@/slack-bot/lib/kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));

import { getSlackClient } from './slackClient';
import { storeTeamToken } from './teamStorage';

describe('getSlackClient', () => {
  it('uses the token stored now, not the one it cached before a reinstall', async () => {
    await storeTeamToken('T1', 'xoxb-old');
    expect((await getSlackClient('T1')).token).toBe('xoxb-old');

    await storeTeamToken('T1', 'xoxb-new');
    expect((await getSlackClient('T1')).token).toBe('xoxb-new');
  });
});
