/**
 * Telling a found event apart from one the calendar already has, or one an
 * earlier run proposed (seen.json). Two names match when they agree once case,
 * accents, years, ordinals ("56th") and filler words are stripped. Within a
 * year, a shared link, or a shared host with overlapping dates, also counts,
 * unless the event's link is only the listing it was found on (ownLink false).
 */
import { normalizeUrl } from '../sync-llm/urls.js';

const FILLER = new Set(['the', 'of', 'and', 'for', 'on', 'in', 'a', 'an', 'annual', 'edition', 'de', 'la', 'le', 'du', 'des', 'et']);

/**
 * @param {string|null|undefined} name
 * @returns {string} '' for a missing name.
 */
export function nameKey(name) {
  return (name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/&/g, ' and ')
    .replace(/\b\d+(st|nd|rd|th)\b|\b(19|20)\d{2}\b/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !FILLER.has(w))
    .join(' ');
}

const keysOf = (e) => [nameKey(e.title), nameKey(e.full_name)].filter(Boolean);
const sameName = (a, b) => keysOf(a).some((k) => keysOf(b).includes(k));

function urlKey(url) {
  try {
    return normalizeUrl(url);
  } catch {
    return null;
  }
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const overlaps = (a, b) => Boolean(a.start && a.end && b.start && b.end) && a.start <= b.end && b.start <= a.end;

function sameEdition(event, entry) {
  if (entry.year !== event.year) return false;
  if (sameName(event, entry)) return true;
  if (event.ownLink === false || entry.ownLink === false) return false;
  const link = urlKey(entry.link ?? '');
  if (link && link === urlKey(event.link)) return true;
  return hostOf(entry.link ?? '') === hostOf(event.link) && overlaps(event, entry);
}

/**
 * @param {{title: string, full_name?: string|null, year: number, link: string, start?: string, end?: string}} event
 * @param {Array<object>} entries Calendar entries (or events accepted earlier in the run).
 * @returns {{same: object|null, prior: object|null}} same is this edition, if
 *   listed; prior is the latest earlier edition under the same name, whose
 *   title, id, subject and type a draft inherits.
 */
export function matchExisting(event, entries) {
  const same = entries.find((e) => sameEdition(event, e)) ?? null;
  let prior = null;
  for (const e of entries) {
    if (e.year < event.year && sameName(event, e) && (!prior || e.year > prior.year)) prior = e;
  }
  return { same, prior };
}

/**
 * @param {Object<string, {title: string, full_name?: string|null, year: number, link: string}>} seen
 * @param {object} event
 * @returns {boolean} Whether an earlier run already proposed this edition.
 */
export function wasProposed(seen, event) {
  return Object.values(seen).some((s) => sameEdition(event, s));
}

/**
 * The seen.json key for an event.
 * @param {{title: string, year: number}} event
 * @returns {string}
 */
export const seenKey = (event) => `${nameKey(event.title)}|${event.year}`;
