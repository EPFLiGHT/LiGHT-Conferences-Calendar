/**
 * Turns an OpenReview venue group into the facts shape scripts/sync-shared/
 * merge.js consumes. The mirror of scripts/sync-llm/facts.js, which does the
 * same for a venue's website.
 */
import { parseVenueDateString, parseStartDate } from './parse.js';

const PLACEHOLDER_RE = /^(tbd|tba)$/i;

/**
 * Distill an OpenReview venue group's `content` into the facts the sync uses.
 * @param {object} content Venue group content (fields wrapped as {value: ...}).
 * @returns {{
 *   fullName: string|null,
 *   location: string|null,
 *   startIso: string|null,
 *   submissionId: string|null,
 *   abstractDeadline: DateTime|null,
 *   deadline: DateTime|null,
 * }} Missing, empty or placeholder ("TBD"/"TBA") values come back as null.
 */
export function buildFacts(content) {
  const value = (key) => content?.[key]?.value;
  const dates = parseVenueDateString(value('date'));
  const location = (value('location') || '').trim();
  return {
    fullName: value('title') || null,
    location: location && !PLACEHOLDER_RE.test(location) ? location : null,
    startIso: parseStartDate(value('start_date')),
    submissionId: value('submission_id') || null,
    abstractDeadline: dates.abstractDeadline || null,
    deadline: dates.deadline || null,
  };
}
