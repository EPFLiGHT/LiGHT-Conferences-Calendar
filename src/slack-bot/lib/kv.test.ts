import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { constructed } = vi.hoisted(() => ({
  constructed: [] as Array<Record<string, unknown>>,
}));

vi.mock('@upstash/redis', () => ({
  Redis: class {
    config: Record<string, unknown>;
    constructor(config: Record<string, unknown>) {
      this.config = config;
      constructed.push(config);
    }
    self() {
      return this;
    }
  },
}));

type FakeRedis = { self(): { config: Record<string, unknown> } };

async function loadKv(): Promise<FakeRedis> {
  vi.resetModules();
  return (await import('./kv')).kv as unknown as FakeRedis;
}

const ENV_NAMES = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL',
  'KV_REST_API_TOKEN',
];

describe('kv client', () => {
  beforeEach(() => {
    constructed.length = 0;
    for (const name of ENV_NAMES) vi.stubEnv(name, '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('does not create a client until first use', async () => {
    await loadKv();
    expect(constructed).toHaveLength(0);
  });

  it('throws on use when credentials are missing', async () => {
    const kv = await loadKv();
    expect(() => kv.self).toThrow(/Missing Redis credentials/);
  });

  it('reads the KV_* names of a migrated Vercel KV store', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token');
    const kv = await loadKv();
    kv.self();
    expect(constructed).toEqual([
      {
        url: 'https://kv.example',
        token: 'kv-token',
        cache: 'default',
        enableAutoPipelining: true,
        enableTelemetry: false,
      },
    ]);
  });

  it('prefers the UPSTASH_* names when both are set', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://upstash.example');
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', 'upstash-token');
    const kv = await loadKv();
    kv.self();
    expect(constructed[0]).toMatchObject({
      url: 'https://upstash.example',
      token: 'upstash-token',
    });
  });

  it('never pairs a URL from one set of names with the token from the other', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token');
    vi.stubEnv('UPSTASH_REDIS_REST_URL', 'https://upstash.example');
    const kv = await loadKv();
    kv.self();
    expect(constructed[0]).toMatchObject({
      url: 'https://kv.example',
      token: 'kv-token',
    });
  });

  it('reuses one client and binds methods to it', async () => {
    vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
    vi.stubEnv('KV_REST_API_TOKEN', 'kv-token');
    const kv = await loadKv();
    const { self } = kv;
    expect(self().config.url).toBe('https://kv.example');
    kv.self();
    expect(constructed).toHaveLength(1);
  });
});
