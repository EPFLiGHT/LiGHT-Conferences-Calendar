import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { store } = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('./kv', () => ({
  kv: {
    async set(key: string, value: unknown, opts?: { nx?: boolean }) {
      if (opts?.nx && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    },
    async del(key: string) {
      return store.delete(key) ? 1 : 0;
    },
  },
}));

import { sendOncePerDay } from './reminderDedup';

describe('sendOncePerDay', () => {
  beforeEach(() => {
    store.clear();
    vi.useFakeTimers({ now: new Date('2026-10-02T09:00:00Z'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sends to a target only once per UTC day', async () => {
    const send = vi.fn(async () => {});
    expect(await sendOncePerDay('dm:U1', send)).toBe(true);
    expect(await sendOncePerDay('dm:U1', send)).toBe(false);
    expect(await sendOncePerDay('dm:U2', send)).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('sends again on the next day', async () => {
    const send = vi.fn(async () => {});
    await sendOncePerDay('dm:U1', send);
    vi.setSystemTime(new Date('2026-10-03T09:00:00Z'));
    expect(await sendOncePerDay('dm:U1', send)).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('lets a later run retry after a failed send', async () => {
    const failing = vi.fn(async () => {
      throw new Error('ratelimited');
    });
    await expect(sendOncePerDay('channel:C1', failing)).rejects.toThrow('ratelimited');

    const send = vi.fn(async () => {});
    expect(await sendOncePerDay('channel:C1', send)).toBe(true);
    expect(send).toHaveBeenCalledOnce();
  });
});
