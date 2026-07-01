/**
 * Conference Data Cache
 * Caches conference data in Vercel KV to reduce YAML parsing overhead
 */

import { kv } from '@vercel/kv';
import type { Conference } from '@/types/conference';
import { parseConferences } from '@/utils/parser';
import { DATA_FILES } from '@/constants/dataFiles';
import { logger } from './logger';
import { NOTIFICATION_CONFIG } from '../config/constants';
import { kvKeys } from '../lib/kvKeys';

const CACHE_KEY = kvKeys.cache.conferences;
const CACHE_TIMESTAMP_KEY = kvKeys.cache.conferencesTimestamp;

/**
 * Fetch conferences from cache or parse from YAML
 */
export async function getConferences(): Promise<Conference[]> {
  try {
    // Try cache first
    const cached = await kv.get<Conference[]>(CACHE_KEY);
    if (cached && cached.length > 0) {
      logger.debug('Conferences loaded from cache', { count: cached.length });
      return cached;
    }

    // Cache miss - fetch and parse YAML
    logger.info('Cache miss - fetching conferences from YAML');
    const conferences = await fetchAndParseYAML();

    // Cache the result
    await cacheConferences(conferences);

    return conferences;
  } catch (error) {
    logger.error('Failed to get conferences', error);
    throw error;
  }
}

/**
 * Fetch YAML from URL and parse with timeout
 */
async function fetchAndParseYAML(): Promise<Conference[]> {
  const baseUrl = process.env.CONFERENCES_DATA_URL;
  const TIMEOUT_MS = 5000;

  const urls = DATA_FILES.map((name) => `${baseUrl}/data/${name}.yaml`);

  logger.info('Fetching conference data from multiple sources', { urls });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const responses = await Promise.all(
      urls.map((url) =>
        fetch(url, {
          signal: controller.signal,
          headers: { 'Cache-Control': 'max-age=300' },
        })
      )
    );

    clearTimeout(timeoutId);

    if (responses.some((res) => !res.ok)) {
      throw new Error(
        `Failed to fetch YAML files: ${responses.map((res) => res.status).join(', ')}`
      );
    }

    const texts = await Promise.all(responses.map((res) => res.text()));
    const allConferences = texts.flatMap((text) => parseConferences(text));

    logger.info('All conference data parsed successfully', {
      sources: DATA_FILES.length,
      total: allConferences.length,
    });

    return allConferences;
  } catch (error) {
    clearTimeout(timeoutId);

    const isTimeout = error instanceof Error && error.name === 'AbortError';
    const errorMessage = isTimeout
      ? 'Request timeout'
      : error instanceof Error ? error.message : String(error);

    logger.error('Failed to fetch and parse YAML', { urls, error: errorMessage });
    throw new Error(`Failed to fetch conference data: ${errorMessage}`);
  }
}

/**
 * Cache conferences with TTL
 */
async function cacheConferences(conferences: Conference[]): Promise<void> {
  try {
    const ttl = NOTIFICATION_CONFIG.CACHE_TTL_SECONDS;
    await kv.set(CACHE_KEY, conferences, { ex: ttl });
    await kv.set(CACHE_TIMESTAMP_KEY, new Date().toISOString(), { ex: ttl });
    logger.info('Conferences cached', { count: conferences.length, ttl });
  } catch (error) {
    logger.error('Failed to cache conferences', error);
    // Non-fatal error - continue without caching
  }
}

/**
 * Invalidate conference cache (force refresh)
 */
export async function invalidateCache(): Promise<void> {
  try {
    await kv.del(CACHE_KEY);
    await kv.del(CACHE_TIMESTAMP_KEY);
    logger.info('Conference cache invalidated');
  } catch (error) {
    logger.error('Failed to invalidate cache', error);
  }
}

/**
 * Get cache status
 */
export async function getCacheStatus(): Promise<{
  cached: boolean;
  timestamp: string | null;
  count: number;
}> {
  try {
    const data = await kv.get<Conference[]>(CACHE_KEY);
    const timestamp = await kv.get<string>(CACHE_TIMESTAMP_KEY);

    return {
      cached: data !== null,
      timestamp,
      count: data?.length || 0,
    };
  } catch (error) {
    logger.error('Failed to get cache status', error);
    return { cached: false, timestamp: null, count: 0 };
  }
}
