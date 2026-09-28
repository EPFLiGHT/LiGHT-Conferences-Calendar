/**
 * Shared Upstash Redis client for bot state.
 * Created on first use so importing a storage module needs no credentials.
 */

import { Redis } from '@upstash/redis';

let client: Redis | undefined;

function getClient(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
    if (!url || !token) {
      throw new Error(
        'Missing Redis credentials: set KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)'
      );
    }
    client = new Redis({
      url,
      token,
      cache: 'default',
      enableAutoPipelining: true,
      enableTelemetry: false,
    });
  }
  return client;
}

export const kv = new Proxy({} as Redis, {
  get(_target, prop) {
    // Not a thenable, so `await kv` or returning kv from an async function stays lazy
    if (prop === 'then') return undefined;
    const redis = getClient();
    const value = Reflect.get(redis, prop, redis);
    return typeof value === 'function' ? value.bind(redis) : value;
  },
});
