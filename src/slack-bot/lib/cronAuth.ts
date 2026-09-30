import type { NextResponse } from 'next/server';
import { errorResponse } from './responses';
import { logger } from './logger';

/**
 * Runs a cron job only for `Authorization: Bearer $CRON_SECRET`, rejecting every caller while the
 * secret is unset. A thrown job becomes a 500.
 */
export function withCronAuth(job: () => Promise<NextResponse>): (request: Request) => Promise<NextResponse> {
  return async (request) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      logger.error('CRON_SECRET is not set; rejecting cron request');
      return errorResponse('Unauthorized', 401);
    }
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return errorResponse('Unauthorized', 401);
    }

    try {
      return await job();
    } catch (error) {
      logger.error('Cron job failed', { path: new URL(request.url).pathname, error });
      return errorResponse('Internal server error');
    }
  };
}
