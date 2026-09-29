import { DateTime } from 'luxon';
import type { Conference } from '@/types/conference';
import { getDeadlineInfo } from './parser';

interface ICSEvent {
  uid: string;
  title: string;
  start: DateTime;
  end: DateTime;
  isAllDay: boolean;
  description?: string;
  location?: string;
  url?: string;
}

export function createICSContent(events: ICSEvent[]): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Conference Deadlines//LiGHT Lab//EN',
    'CALSCALE:GREGORIAN',
  ];

  events.forEach(event => {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${DateTime.now().toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);

    if (event.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${event.start.toFormat('yyyyMMdd')}`);
      lines.push(`DTEND;VALUE=DATE:${event.end.plus({ days: 1 }).toFormat('yyyyMMdd')}`);
    } else {
      lines.push(`DTSTART:${event.start.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);
      lines.push(`DTEND:${event.end.toUTC().toFormat("yyyyMMdd'T'HHmmss'Z'")}`);
    }

    lines.push(`SUMMARY:${escapeICS(event.title)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
    }

    if (event.location) {
      lines.push(`LOCATION:${escapeICS(event.location)}`);
    }

    if (event.url) {
      lines.push(`URL:${event.url}`);
    }

    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

function escapeICS(str: string): string {
  return str.replace(/[,;\\]/g, '\\$&').replace(/\n/g, '\\n');
}

export function downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// Imported calendars key events by UID and show these titles, so neither may change.
const DEADLINE_EVENTS = {
  abstract: { uid: 'abstract', title: 'Abstract Deadline', description: 'Abstract submission deadline' },
  paper: { uid: 'deadline', title: 'Paper Deadline', description: 'Paper submission deadline' },
} as const;

export function conferenceToICSEvents(conference: Conference): ICSEvent[] {
  const events: ICSEvent[] = [];

  if (conference.start && conference.end) {
    const start = DateTime.fromISO(conference.start);
    const end = DateTime.fromISO(conference.end);
    if (start.isValid && end.isValid) {
      events.push({
        uid: `conf-${conference.id}@conference-deadlines`,
        title: `${conference.title} ${conference.year}`,
        start,
        end,
        isAllDay: true,
        location: conference.place,
        description: conference.full_name,
        url: conference.link,
      });
    }
  }

  for (const deadline of getDeadlineInfo(conference)) {
    const { uid, title, description } = DEADLINE_EVENTS[deadline.kind];
    events.push({
      uid: `${uid}-${conference.id}@conference-deadlines`,
      title: `${title}: ${conference.title} ${conference.year}`,
      start: deadline.datetime,
      end: deadline.datetime.plus({ hours: 1 }),
      isAllDay: false,
      description: `${description} for ${conference.full_name}`,
      url: conference.link,
    });
  }

  return events;
}

export function exportConference(conference: Conference): void {
  const events = conferenceToICSEvents(conference);
  const content = createICSContent(events);
  downloadICS(content, `${conference.id}-deadlines.ics`);
}
