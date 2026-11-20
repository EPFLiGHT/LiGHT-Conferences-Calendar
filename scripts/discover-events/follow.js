/**
 * The scripts/sync-llm/venues.json entry that keeps a draft's deadlines current
 * after it is kept, so a call that opens after discovery still reaches the
 * calendar. A draft with a call is followed at the page that gave it; one
 * without is followed for its dates and any later call, at tier 0 only. A
 * curated listing is never followed: it announces other events too.
 */
import { DEADLINE_TYPES } from '../../src/constants/deadlineTypes.data.js';

/** The data files the LLM sync reads. */
const SYNCED_FILES = new Set(['conferences.yaml', 'summits.yaml']);

/**
 * @param {{event: object, entry: object, file: string}} proposal A drafted event.
 * @param {Set<string>} followed Titles either sync already follows.
 * @returns {{cfg: {url: string, home?: string, attendance?: true}}|{note: string}}
 *   The venue config, or a note for the report on why there is none.
 */
export function followConfig({ event, entry, file }, followed) {
  if (!SYNCED_FILES.has(file)) return { note: `not followed: the syncs do not read ${file}` };
  if (followed.has(entry.title)) return { note: 'already followed' };
  const own = event.callsLink ?? (event.ownLink ? entry.link : null);
  const call = entry.deadlines?.some((d) => DEADLINE_TYPES[d.type].group === 'submission');
  if (call && !event.curated) {
    return { cfg: { url: event.sourceUrl, ...(entry.link !== event.sourceUrl ? { home: entry.link } : {}) } };
  }
  if (!own) return { note: 'not followed: its only page lists other events too' };
  return { cfg: call ? { url: own } : { url: own, attendance: true } };
}
