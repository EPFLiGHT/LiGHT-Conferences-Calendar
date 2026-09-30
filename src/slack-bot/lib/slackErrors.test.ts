import { describe, it, expect } from 'vitest';
import { WebAPIPlatformError, WebAPIRateLimitedError } from '@slack/web-api';
import { classifySlackError } from './slackErrors';

const platformError = (code: string) => new WebAPIPlatformError({ ok: false, error: code });

describe('classifySlackError', () => {
  it.each(['account_inactive', 'token_revoked'])('treats %s as the workspace being gone', (code) => {
    expect(classifySlackError(platformError(code))).toBe('team_gone');
  });

  it('does not purge a workspace over a misconfigured token', () => {
    expect(classifySlackError(platformError('invalid_auth'))).toBe('other');
  });

  it.each(['channel_not_found', 'is_archived', 'not_in_channel', 'user_not_found', 'user_disabled', 'cannot_dm_bot'])(
    'treats %s as the channel or user being gone',
    (code) => {
      expect(classifySlackError(platformError(code))).toBe('target_gone');
    }
  );

  it('leaves transient and unknown failures alone', () => {
    expect(classifySlackError(platformError('ratelimited'))).toBe('other');
    expect(classifySlackError(new WebAPIRateLimitedError(30))).toBe('other');
    expect(classifySlackError(new Error('token_revoked'))).toBe('other');
    expect(classifySlackError(undefined)).toBe('other');
  });
});
