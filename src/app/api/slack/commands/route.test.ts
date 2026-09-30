import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetKv } from '@/slack-bot/testing/fakeKv';
import { SIGNING_SECRET, slashCommand } from '@/slack-bot/testing/slackRequest';

const { fetchEvents } = vi.hoisted(() => ({ fetchEvents: vi.fn() }));

vi.mock('@/slack-bot/lib/kv', async () => ({ kv: (await import('@/slack-bot/testing/fakeKv')).fakeKv }));
vi.mock('@/utils/eventData', () => ({ fetchEvents }));

import { POST } from './route';

async function reply(command: string, text = ''): Promise<{ text: string; response_type: string }> {
  const res = await POST(slashCommand(command, text));
  expect(res.status).toBe(200);
  return res.json();
}

describe('slash commands', () => {
  beforeEach(() => {
    resetKv();
    fetchEvents.mockReset();
    vi.stubEnv('SLACK_SIGNING_SECRET', SIGNING_SECRET);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('tells the user when loading conference data timed out', async () => {
    fetchEvents.mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError'));

    const body = await reply('/conf-upcoming');

    expect(body.text).toContain('timed out');
    expect(body.response_type).toBe('ephemeral');
  });

  it('answers any other failure with the generic error', async () => {
    fetchEvents.mockRejectedValue(new Error('HTTP 503'));

    const body = await reply('/conf-search', 'cvpr');

    expect(body.text).toContain('An error occurred');
    expect(body.response_type).toBe('ephemeral');
  });

  it('points unknown commands at /conf-help', async () => {
    const body = await reply('/conf-nope');

    expect(body.text).toContain('/conf-help');
    expect(body.response_type).toBe('ephemeral');
  });
});
