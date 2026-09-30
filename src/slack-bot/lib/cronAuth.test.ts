import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from './cronAuth';

function cronRoute(job: () => Promise<NextResponse> = async () => NextResponse.json({ ok: true })) {
  const handler = vi.fn(job);
  return { handler, route: withCronAuth(handler) };
}

const request = (authorization?: string) =>
  new NextRequest('http://localhost/api/slack/cron/daily-check', {
    headers: authorization ? { authorization } : {},
  });

describe('cron authentication', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects every caller when no secret is configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const { handler, route } = cronRoute();

    const res = await route(request());

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects a wrong bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const { handler, route } = cronRoute();

    const res = await route(request('Bearer nope'));

    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('runs the job for the configured bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const { handler, route } = cronRoute();

    const res = await route(request('Bearer s3cret'));

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('answers 500 when the job throws', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const { route } = cronRoute(async () => {
      throw new Error('redis down');
    });

    expect((await route(request('Bearer s3cret'))).status).toBe(500);
  });
});
