import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchSpeakers } from '@/hooks/useSpeakers';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchSpeakers', () => {
  it('parses the speakers file', async () => {
    const yaml = '- id: ada\n  name: Ada\n  presentations: []\n';
    vi.stubGlobal('fetch', async (url: string) =>
      url === '/data/speakers.yaml' ? new Response(yaml) : new Response('', { status: 404 })
    );
    expect(await fetchSpeakers()).toEqual([{ id: 'ada', name: 'Ada', presentations: [] }]);
  });

  it('throws when the file is missing', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 404 }));
    await expect(fetchSpeakers()).rejects.toThrow('Failed to fetch speakers data');
  });
});
