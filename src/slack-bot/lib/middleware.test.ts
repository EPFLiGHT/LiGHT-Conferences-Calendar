import { describe, it, expect, vi, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { withSlackMiddleware, SlackRequestType } from './middleware';

function cronRoute() {
  const handler = vi.fn(() => NextResponse.json({ ok: true }));
  const route = withSlackMiddleware({
    requestType: SlackRequestType.CRON,
    handler,
    authConfig: { requireAuth: true },
  });
  return { handler, route };
}

const request = (authorization?: string) =>
  new NextRequest('http://localhost/api/slack/cron/daily-check', {
    headers: authorization ? { authorization } : {},
  });

describe('cron authentication', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
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
});
