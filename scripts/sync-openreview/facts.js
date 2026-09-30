/**
 * Turns an OpenReview venue group into the facts object scripts/sync-shared/
 * merge.js consumes.
 */
import { parseVenueDateString, parseStartDate } from './parse.js';

const PLACEHOLDER_RE = /^(tbd|tba)$/i;

/**
 * Distill an OpenReview venue group's `content` into the facts the sync uses.
 * OpenReview occasionally serves a field as a number (e.g. LoG's start_date as
 * an epoch); such values are ignored rather than read in an unknown timezone.
 * @param {object} content Venue group content (fields wrapped as {value: ...}).
 * @returns {{
 *   fullName: string|null,
 *   location: string|null,
 *   startIso: string|null,
 *   endIso: null,
 *   link: string|null,
 *   submissionId: string|null,
 *   abstractDeadline: DateTime|null,
 *   deadline: DateTime|null,
 * }} Missing, non-string, empty or placeholder ("TBD"/"TBA") values come back
 *   as null. OpenReview never states an end date, so endIso is always null;
 *   link is the edition's website.
 */
export function buildFacts(content) {
  const value = (key) => {
    const v = content?.[key]?.value;
    return typeof v === 'string' ? v.trim() : '';
  };
  const dates = parseVenueDateString(value('date'));
  const location = value('location');
  return {
    fullName: value('title') || null,
    location: location && !PLACEHOLDER_RE.test(location) ? location : null,
    startIso: parseStartDate(value('start_date')),
    endIso: null,
    link: value('website') || null,
    submissionId: value('submission_id') || null,
    abstractDeadline: dates.abstractDeadline || null,
    deadline: dates.deadline || null,
  };
}
