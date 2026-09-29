import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchEvents } from '@/utils/eventData';

const entry = (id: string, type: string) =>
  `- title: ${id}\n  year: 2026\n  id: ${id}\n  timezone: UTC\n  type: ${type}\n`;

const FILES: Record<string, string> = {
  'https://site.test/data/conferences.yaml': entry('conf26', 'conference'),
  'https://site.test/data/summits.yaml': entry('summit26', 'summit'),
  'https://site.test/data/workshops.yaml': entry('shop26', 'workshop'),
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchEvents', () => {
  it('merges every data file under the base URL', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url in FILES ? new Response(FILES[url]) : new Response('', { status: 404 })
    );
    const events = await fetchEvents('https://site.test');
    expect(events.map((e) => e.id)).toEqual(['conf26', 'summit26', 'shop26']);
  });

  it('throws with the statuses when a file is missing', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url.endsWith('summits.yaml') ? new Response('', { status: 404 }) : new Response(FILES[url])
    );
    await expect(fetchEvents('https://site.test')).rejects.toThrow('200, 404, 200');
  });
});
