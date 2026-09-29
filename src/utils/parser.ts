import { load } from 'js-yaml';
import { DateTime } from 'luxon';
import { SUBJECT_COLORS, DEFAULT_SUBJECT_COLOR } from '@/constants/subjects';
import { parseEntryDateTime } from '@/utils/conferenceSchema';
import type { Conference, DeadlineInfo } from '@/types/conference';

// Entries are validated in CI (pnpm validate); parsing only fills defaults.
export function parseConferences(yamlString: string): Conference[] {
  const entries = load(yamlString);
  if (!Array.isArray(entries)) {
    throw new Error('YAML must contain an array of conferences');
  }
  return entries.map((conf) => ({
    ...conf,
    full_name: conf.full_name || conf.title,
    sub: conf.sub ? [conf.sub].flat() : ['General'],
  }));
}

const DEADLINE_FIELDS = [
  { kind: 'abstract', field: 'abstract_deadline', label: 'Abstract Deadline' },
  { kind: 'paper', field: 'deadline', label: 'Paper Submission' },
] as const;

export function getDeadlineInfo(conference: Conference): DeadlineInfo[] {
  return DEADLINE_FIELDS.flatMap(({ kind, field, label }) => {
    const value = conference[field];
    if (!value) return [];
    const datetime = parseEntryDateTime(value, conference.timezone);
    return datetime.isValid ? [{ kind, label, datetime, localDatetime: datetime.toLocal() }] : [];
  });
}

export function getNextDeadline(conference: Conference): DeadlineInfo | null {
  const deadlines = getDeadlineInfo(conference);
  if (deadlines.length === 0) return null;

  const now = DateTime.now();
  // The first upcoming deadline, else the most recent expired one.
  return deadlines.find((d) => d.localDatetime > now) ?? deadlines[deadlines.length - 1];
}

export function getNoDeadlineLabel(conference: Conference): string {
  switch (conference.deadline_status) {
    case 'attendance':
      return 'Registration only, no submission';
    case 'tba':
      return 'Deadline to be announced';
    default:
      return 'No deadlines on record';
  }
}

/** Calendar color of an event: its first subject's color. */
export function getEventColor(subjects: string[]): string {
  return SUBJECT_COLORS[subjects[0]] ?? DEFAULT_SUBJECT_COLOR;
}
