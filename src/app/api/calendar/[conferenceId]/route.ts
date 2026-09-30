import { NextRequest, NextResponse } from 'next/server';
import { getConferences } from '@/slack-bot/lib/conferences';
import { logger } from '@/slack-bot/lib/logger';
import { conferenceToICSEvents, createICSContent } from '@/utils/ics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** ICS file with a conference's dates and deadlines. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ conferenceId: string }> }
): Promise<NextResponse> {
  const { conferenceId } = await params;

  const conferences = await getConferences().catch((error) => {
    logger.error('Calendar data unavailable', { conferenceId, error });
    return null;
  });
  if (!conferences) {
    return NextResponse.json({ error: 'Failed to fetch conference data' }, { status: 500 });
  }

  const conference = conferences.find((c) => c.id === conferenceId);
  if (!conference) {
    return NextResponse.json({ error: `Conference not found: ${conferenceId}` }, { status: 404 });
  }

  const events = conferenceToICSEvents(conference);
  if (events.length === 0) {
    return NextResponse.json({ error: 'No calendar events available for this conference' }, { status: 404 });
  }

  return new NextResponse(createICSContent(events), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${conference.id}-deadlines.ics"`,
    },
  });
}
