import { load } from 'js-yaml';
import { DateTime } from 'luxon';
import { SUBJECT_COLORS, DEFAULT_SUBJECT_COLOR } from '@/constants/subjects';
import { deadlineGroup, deadlineLabel, deadlineShortLabel, isDeadlineType } from '@/constants/deadlineTypes';
import { parseEntryDateTime } from '@/utils/conferenceSchema';
import type { Conference, ConferenceDeadline, DeadlineInfo } from '@/types/conference';

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

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Keys predating typed deadlines stay: "abstract" for paper_abstract and abstract, "deadline" for paper.
function baseKey(item: ConferenceDeadline): string {
  if (item.type === 'paper_abstract' || item.type === 'abstract') return 'abstract';
  if (item.type === 'paper') return 'deadline';
  if (item.type === 'other') return `other-${slug(item.label ?? '')}`;
  return item.type.replace(/_/g, '-');
}

/** Each item's key: its base, suffixed only when another item of the entry shares the base. */
function deadlineKeys(items: ConferenceDeadline[]): string[] {
  const bases = items.map(baseKey);
  return items.map((item, i) => {
    const clashes = items.filter((_, j) => j !== i && bases[j] === bases[i]);
    if (clashes.length === 0) return bases[i];
    if (item.label) return `${bases[i]}-${slug(item.label)}`;
    return clashes.some((c) => !c.label) ? `${bases[i]}-${item.type.replace(/_/g, '-')}` : bases[i];
  });
}

/** The entry's deadlines in due order; items of an unknown type, or whose due is not a parseable string, are skipped. */
export function getDeadlineInfo(conference: Conference): DeadlineInfo[] {
  const items = (conference.deadlines ?? []).filter((d) => typeof d?.due === 'string' && isDeadlineType(d.type));
  const keys = deadlineKeys(items);
  return items
    .flatMap((item, i): DeadlineInfo[] => {
      const datetime = parseEntryDateTime(item.due, conference.timezone);
      if (!datetime.isValid) return [];
      return [{
        key: keys[i],
        type: item.type,
        group: deadlineGroup(item.type),
        label: deadlineLabel(item),
        shortLabel: deadlineShortLabel(item),
        datetime,
        localDatetime: datetime.toLocal(),
      }];
    })
    .sort((a, b) => a.datetime.toMillis() - b.datetime.toMillis());
}

export function getNextDeadline(conference: Conference): DeadlineInfo | null {
  const deadlines = getDeadlineInfo(conference);
  if (deadlines.length === 0) return null;

  const now = DateTime.now();
  // The first upcoming deadline, else the most recent expired one.
  return deadlines.find((d) => d.localDatetime > now) ?? deadlines[deadlines.length - 1];
}

/** The first `max` upcoming deadlines and how many more are upcoming; with none upcoming, the latest passed one. */
export function getCardDeadlines(conference: Conference, max: number): { shown: DeadlineInfo[]; more: number } {
  const deadlines = getDeadlineInfo(conference);
  const now = DateTime.now();
  const upcoming = deadlines.filter((d) => d.localDatetime > now);
  if (upcoming.length === 0) return { shown: deadlines.slice(-1), more: 0 };
  return { shown: upcoming.slice(0, max), more: Math.max(0, upcoming.length - max) };
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
