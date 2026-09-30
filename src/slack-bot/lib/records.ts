import { kv } from './kv';

export interface RecordStore<T> {
  get(id: string): Promise<T | null>;
  put(id: string, record: T): Promise<void>;
  remove(id: string): Promise<void>;
  all(): Promise<T[]>;
}

/**
 * JSON records stored one per key and enumerated through a Redis set of their ids.
 * `pick` keeps the current fields, so records with retired fields still load. Redis errors propagate.
 */
export function recordStore<T>(options: {
  key: (id: string) => string;
  index: string;
  pick: (stored: T) => T;
}): RecordStore<T> {
  const { key, index, pick } = options;

  return {
    async get(id) {
      const stored = await kv.get<T>(key(id));
      return stored ? pick(stored) : null;
    },
    async put(id, record) {
      await Promise.all([kv.set(key(id), record), kv.sadd(index, id)]);
    },
    async remove(id) {
      await Promise.all([kv.del(key(id)), kv.srem(index, id)]);
    },
    async all() {
      const ids = await kv.smembers(index);
      const stored = await Promise.all(ids.map((id) => kv.get<T>(key(id))));
      return stored.flatMap((record) => (record ? [pick(record)] : []));
    },
  };
}
