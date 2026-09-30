/**
 * In-memory stand-in for the Upstash client, for tests. Wire it up with
 * `vi.mock('@/slack-bot/lib/kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }))`.
 */

const values = new Map<string, string>();
const sets = new Map<string, Set<string>>();

// Serializes like @upstash/redis: strings as-is, everything else as JSON, decoded on read.
function decode(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export const fakeKv = {
  async get<T>(key: string): Promise<T | null> {
    const raw = values.get(key);
    return raw === undefined ? null : (decode(raw) as T);
  },
  async set(key: string, value: unknown, opts?: { nx?: boolean; ex?: number }): Promise<'OK' | null> {
    if (opts?.nx && values.has(key)) return null;
    values.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    return 'OK';
  },
  async del(...keys: string[]): Promise<number> {
    return keys.filter((key) => values.delete(key) || sets.delete(key)).length;
  },
  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = sets.get(key) ?? new Set<string>();
    sets.set(key, set);
    const before = set.size;
    members.forEach((member) => set.add(member));
    return set.size - before;
  },
  async srem(key: string, ...members: string[]): Promise<number> {
    const set = sets.get(key);
    return set ? members.filter((member) => set.delete(member)).length : 0;
  },
  async smembers(key: string): Promise<string[]> {
    return [...(sets.get(key) ?? [])];
  },
};

export function resetKv(): void {
  values.clear();
  sets.clear();
}
