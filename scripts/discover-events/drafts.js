/**
 * A validated event as a calendar entry, in the field order of the hand-written
 * summits. A new edition of an event the calendar already lists keeps that
 * entry's title, subject and type, its id with the year swapped, and its full
 * name when the page gives none.
 */
import { formatDateRange, nextId } from '../sync-shared/dates.js';
import { cleanFullName } from '../sync-shared/names.js';

/** The data file each entry type lives in, under public/data/. */
export const DATA_FILES = { conference: 'conferences.yaml', summit: 'summits.yaml', workshop: 'workshops.yaml' };

const slug = (s) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]/g, '');

/**
 * @param {object} event From validateEvents.
 * @param {{prior?: object|null, takenIds: Set<string>}} ctx
 * @returns {{entry: object, file: string, notes: string[]}|{error: string}} notes
 *   are for the reviewer.
 */
export function buildDraft(event, { prior = null, takenIds }) {
  const title = prior?.title ?? event.title;
  const base = slug(title);
  if (!base) return { error: `"${title}" gives no usable id` };
  const id = prior && /\d{2}$/.test(prior.id)
    ? nextId(prior.id, event.year)
    : `${base}${String(event.year).slice(-2)}`;
  if (takenIds.has(id)) return { error: `id ${id} is already taken` };

  const pageName = cleanFullName(event.full_name, { title, year: event.year });
  const fullName = pageName ?? prior?.full_name;
  const notes = !pageName && prior?.full_name ? [`full_name kept from ${prior.id}; check its edition ordinal`] : [];
  const sub = prior?.sub ?? (event.subjects.length === 1 ? event.subjects[0] : event.subjects);
  const type = prior?.type ?? event.type;
  const entry = {
    title,
    year: event.year,
    id,
    deadline_status: 'attendance',
    ...(fullName ? { full_name: fullName } : {}),
    link: event.link,
    timezone: 'Europe/Zurich',
    place: `${event.city}, Switzerland`,
    date: formatDateRange(event.start, event.end),
    start: event.start,
    end: event.end,
    sub,
    type,
  };
  return { entry, file: DATA_FILES[type], notes };
}
