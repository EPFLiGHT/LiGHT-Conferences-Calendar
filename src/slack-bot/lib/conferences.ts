import { kv } from './kv';
import type { Conference } from '@/types/conference';
import { fetchEvents } from '@/utils/eventData';
import { logger } from './logger';
import { NOTIFICATION_CONFIG } from '../config/constants';
import { kvKeys } from './kvKeys';

const FETCH_TIMEOUT_MS = 5000;

export class ConferenceFetchError extends Error {
  constructor(readonly timedOut: boolean, cause: unknown) {
    const reason = timedOut ? 'Request timeout' : cause instanceof Error ? cause.message : String(cause);
    super(`Failed to fetch conference data: ${reason}`, { cause });
    this.name = 'ConferenceFetchError';
  }
}

/** Events from the Redis cache, refilled from the public data files on a miss. */
export async function getConferences(): Promise<Conference[]> {
  const cached = await bestEffort('read', () => kv.get<Conference[]>(kvKeys.cache.conferences));
  if (cached && cached.length > 0) return cached;

  const conferences = await fetchFromSource();
  await bestEffort('write', () =>
    kv.set(kvKeys.cache.conferences, conferences, { ex: NOTIFICATION_CONFIG.CACHE_TTL_SECONDS })
  );
  return conferences;
}

// The cache is optional: a Redis error, or missing credentials (which throw synchronously), is a miss.
async function bestEffort<T>(action: string, op: () => Promise<T>): Promise<T | null> {
  try {
    return await op();
  } catch (error) {
    logger.warn(`Conference cache ${action} failed`, { error });
    return null;
  }
}

async function fetchFromSource(): Promise<Conference[]> {
  try {
    return await fetchEvents(process.env.CONFERENCES_DATA_URL, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'Cache-Control': 'max-age=300' },
    });
  } catch (error) {
    throw new ConferenceFetchError(error instanceof Error && error.name === 'TimeoutError', error);
  }
}
