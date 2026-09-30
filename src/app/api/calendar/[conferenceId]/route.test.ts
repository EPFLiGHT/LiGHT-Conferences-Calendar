import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/slack-bot/lib/conferences', () => ({
  getConferences: async () => [
    {
      id: 'himss27',
      title: 'HIMSS',
      year: 2027,
      full_name: 'HIMSS Global Health Conference',
      sub: ['Global Health'],
      type: 'summit',
      timezone: 'America/Chicago',
      start: '2027-03-01',
      end: '2027-03-04',
    },
  ],
}));

const { GET } = await import('./route');

const get = (conferenceId: string) =>
  GET(new NextRequest(`http://localhost/api/calendar/${conferenceId}`), {
    params: Promise.resolve({ conferenceId }),
  });

describe('GET /api/calendar/[conferenceId]', () => {
  it('serves an ICS file for an event outside conferences.yaml', async () => {
    const res = await get('himss27');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/calendar');
    expect(await res.text()).toContain('UID:conf-himss27@conference-deadlines');
  });

  it('returns 404 for an unknown id', async () => {
    expect((await get('nope99')).status).toBe(404);
  });
});
