/**
 * Keeps venues.json pointing at the page the deadlines were last found on, so
 * the next run starts at tier 0 instead of paying for the agent again.
 */
import { normalizeUrl } from './urls.js';
import { rollUrl, urlYear } from '../sync-shared/dates.js';

/**
 * Whether venues.json should start pointing at the page the deadlines were
 * found on. A configured URL too malformed to normalize counts as different:
 * it needs the update most of all.
 */
export function urlNeedsUpdate(configuredUrl, sourceUrl) {
  try {
    return normalizeUrl(configuredUrl) !== sourceUrl;
  } catch {
    return true;
  }
}

/**
 * The venue home moved to the year the deadlines were found for, if that page
 * loads, so the agent starts from the current edition.
 * @returns {Promise<string|null>} The new home, or null to keep the old one.
 */
export async function nextHome(cfg, sourceUrl, fetcher) {
  const from = cfg.home ? urlYear(cfg.home) : null;
  const to = urlYear(sourceUrl);
  if (!from || !to || to <= from) return null;
  const home = rollUrl(cfg.home, from, to);
  if (!home) return null;
  const page = await fetcher.fetchPage(home);
  return page.ok ? home : null;
}

/**
 * Point a venue's config at the page its deadlines were found on.
 * @param {string} title Venue title.
 * @param {{url: string, home?: string}} cfg The venues.json value (mutated).
 * @param {string} sourceUrl Normalized URL the deadlines came from.
 * @param {{fetchPage: Function}} fetcher
 * @returns {Promise<string[]>} Report flags for whatever moved.
 */
export async function followSource(title, cfg, sourceUrl, fetcher) {
  if (!urlNeedsUpdate(cfg.url, sourceUrl)) return [];
  const flags = [`${title}: deadlines found at ${sourceUrl}, not the configured URL; venues.json updated`];
  cfg.url = sourceUrl;
  const home = await nextHome(cfg, sourceUrl, fetcher);
  if (home) {
    flags.push(`${title}: venue home moved to ${home}`);
    cfg.home = home;
  }
  return flags;
}
