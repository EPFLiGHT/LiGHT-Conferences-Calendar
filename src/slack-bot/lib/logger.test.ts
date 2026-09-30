import { describe, it, expect, vi, afterEach } from 'vitest';
import { logger } from './logger';

function lastEntry(method: 'log' | 'warn' | 'error'): Record<string, any> {
  const spy = vi.mocked(console[method]);
  return JSON.parse(spy.mock.calls[spy.mock.calls.length - 1][0] as string);
}

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes an Error under meta.error, keeping the other fields', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    logger.warn('Welcome message failed', { error: new Error('boom'), channel: 'C1' });

    const entry = lastEntry('warn');
    expect(entry).toMatchObject({ level: 'WARN', message: 'Welcome message failed', channel: 'C1' });
    expect(entry.error).toMatchObject({ name: 'Error', message: 'boom' });
    expect(entry.error.stack).toContain('boom');
  });

  it('takes the same (message, meta) shape at the error level', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    logger.error('Command failed', { error: new TypeError('bad'), userId: 'U1' });

    const entry = lastEntry('error');
    expect(entry).toMatchObject({ level: 'ERROR', userId: 'U1' });
    expect(entry.error).toMatchObject({ name: 'TypeError', message: 'bad' });
  });

  it('adds the Slack API error code when present', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const slackError = Object.assign(new Error('An API error occurred: token_revoked'), {
      data: { ok: false, error: 'token_revoked' },
    });
    logger.error('Post failed', { error: slackError });

    expect(lastEntry('error').error.slackError).toBe('token_revoked');
  });

  it('stringifies non-Error values', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('odd', { error: 'plain text' });

    expect(lastEntry('log').error).toEqual({ message: 'plain text' });
  });
});
