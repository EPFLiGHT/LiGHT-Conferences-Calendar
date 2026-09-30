import { describe, it, expect, vi, afterEach } from 'vitest';
import { appUrl } from './appUrl';

describe('appUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the production deployment', () => {
    vi.stubEnv('APP_URL', '');
    expect(appUrl()).toBe('https://conferences-calendar.vercel.app');
  });

  it('uses APP_URL when set, without a trailing slash', () => {
    vi.stubEnv('APP_URL', 'https://preview.example.dev/');
    expect(appUrl()).toBe('https://preview.example.dev');
  });
});
