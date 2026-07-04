import { load } from 'js-yaml';
import { DateTime } from 'luxon';
import { SUBJECT_COLORS, DEFAULT_SUBJECT_COLOR } from '@/constants/subjects';
import {
  REQUIRED_FIELDS,
  YEAR_MIN,
  YEAR_MAX,
  isValidTimezone,
  isValidDateTime,
  isValidDate,
} from '@/utils/conferenceSchema';
import type { Conference, DeadlineInfo } from '@/types/conference';

/**
 * Converts a date string to ISO 8601 format by replacing space with 'T'
 */
export function toISOFormat(dateString: string): string {
  return dateString.replace(' ', 'T');
}

function validateConference(conf: any, index: number): string[] {
  const errors: string[] = [];

  // Check required fields
  REQUIRED_FIELDS.forEach((field) => {
    if (!conf[field]) {
      errors.push(`Conference at index ${index}: Missing required field '${field}'`);
    }
  });

  // Validate timezone
  if (conf.timezone && !isValidTimezone(conf.timezone)) {
    errors.push(`Conference '${conf.id}': Invalid IANA timezone '${conf.timezone}'`);
  }

  // Validate datetime fields (deadline, abstract_deadline)
  (['deadline', 'abstract_deadline'] as const).forEach((field) => {
    if (conf[field] && !isValidDateTime(String(conf[field]))) {
      errors.push(`Conference '${conf.id}': Invalid datetime format for '${field}': ${conf[field]}`);
    }
  });

  // Validate date-only fields (start, end)
  (['start', 'end'] as const).forEach((field) => {
    if (conf[field] && !isValidDate(String(conf[field]))) {
      errors.push(`Conference '${conf.id}': Invalid date format for '${field}': ${conf[field]}`);
    }
  });

  // Validate year format
  if (conf.year && (typeof conf.year !== 'number' || conf.year < YEAR_MIN || conf.year > YEAR_MAX)) {
    errors.push(`Conference '${conf.id}': Invalid year '${conf.year}'`);
  }

  // Validate h-index
  if (conf.hindex !== undefined && (typeof conf.hindex !== 'number' || conf.hindex < 0)) {
    errors.push(`Conference '${conf.id}': Invalid h-index '${conf.hindex}'`);
  }

  return errors;
}

export function parseConferences(yamlString: string): Conference[] {
  try {
    const conferences = load(yamlString) as any[];

    if (!Array.isArray(conferences)) {
      throw new Error('YAML must contain an array of conferences');
    }

    // Validate all conferences
    const allErrors: string[] = [];
    conferences.forEach((conf, index) => {
      const errors = validateConference(conf, index);
      allErrors.push(...errors);
    });

    // Check for duplicate IDs
    const ids = conferences.map((c) => c.id).filter(Boolean);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length > 0) {
      allErrors.push(`Duplicate conference IDs found: ${duplicates.join(', ')}`);
    }

    if (allErrors.length > 0) {
      console.warn('Conference validation warnings:', allErrors);
    }

    // Fill in TBA for missing optional fields
    return conferences.map((conf) => ({
      ...conf,
      full_name: conf.full_name || conf.title,
      link: conf.link || null,
      deadline: conf.deadline || null,
      abstract_deadline: conf.abstract_deadline || null,
      place: conf.place || 'TBA',
      date: conf.date || 'TBA',
      start: conf.start || null,
      end: conf.end || null,
      paperslink: conf.paperslink || null,
      pwclink: conf.pwclink || null,
      hindex: conf.hindex || 0,
      sub: conf.sub || 'General',
      note: conf.note || '',
    })) as Conference[];
  } catch (error) {
    console.error('Error parsing YAML:', error);
    throw error;
  }
}

export function getDeadlineInfo(conference: Conference, userTimezone: string = 'local'): DeadlineInfo[] {
  const deadlines: DeadlineInfo[] = [];

  if (conference.abstract_deadline) {
    const dt = DateTime.fromISO(toISOFormat(conference.abstract_deadline), { zone: conference.timezone });
    if (dt.isValid) {
      deadlines.push({
        label: 'Abstract Deadline',
        datetime: dt,
        localDatetime: userTimezone === 'local' ? dt.toLocal() : dt.setZone(userTimezone),
      });
    }
  }

  if (conference.deadline) {
    const dt = DateTime.fromISO(toISOFormat(conference.deadline), { zone: conference.timezone });
    if (dt.isValid) {
      deadlines.push({
        label: 'Paper Submission',
        datetime: dt,
        localDatetime: userTimezone === 'local' ? dt.toLocal() : dt.setZone(userTimezone),
      });
    }
  }

  return deadlines;
}

export function getNextDeadline(conference: Conference): DeadlineInfo | null {
  const deadlines = getDeadlineInfo(conference);
  if (deadlines.length === 0) return null;

  const now = DateTime.now();

  // First try to find upcoming deadlines
  const upcoming = deadlines.filter((d) => d.localDatetime > now);
  if (upcoming.length > 0) return upcoming[0];

  // If no upcoming deadlines, return the most recent expired one
  return deadlines[deadlines.length - 1];
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

function getSubjectColor(subject: string) {
  return SUBJECT_COLORS[subject] || DEFAULT_SUBJECT_COLOR;
}

export function getSubjectsArray(sub: string | string[]): string[] {
  if (!sub) return ['General'];
  if (Array.isArray(sub)) return sub.filter(Boolean);
  return [sub].filter(Boolean);
}

// Generate event color based on subject tag(s)
export function getEventColorFromSubjects(subjects: string | string[]): {
  backgroundColor: string;
  borderColor: string;
} {
  const subjectsArray = getSubjectsArray(subjects);

  // Use the first subject's color in case of multiple tags
  const subjectColor = getSubjectColor(subjectsArray[0]);
  return {
    backgroundColor: subjectColor.color,
    borderColor: subjectColor.color,
  };
}
