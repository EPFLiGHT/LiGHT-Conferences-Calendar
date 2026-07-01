/**
 * Base names of the YAML data files under public/data.
 * Single source of truth for "which event files exist" - consumed by the web
 * hook (useConferences), the Slack bot cache (conferenceCache) and the data
 * validator (scripts/validate.js). Add a file here once and all three follow.
 *
 * Plain ESM JavaScript so scripts/validate.js (Node, no TypeScript) can import it.
 */
export const DATA_FILES = ['conferences', 'summits', 'workshops'];
