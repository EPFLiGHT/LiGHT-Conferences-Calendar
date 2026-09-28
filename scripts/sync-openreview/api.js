/**
 * Thin client for the public OpenReview API v2 (no auth needed). The only
 * file in the sync that touches the network; `fetch` is injectable so tests
 * never make real requests.
 */
const BASE = 'https://api2.openreview.net';
const MAX_RATE_LIMIT_RETRIES = 3;

/**
 * GET a JSON endpoint; a 404 resolves to null. The API allows 20 requests a
 * minute, so a 429 waits out the window and retries. Other failures throw, so
 * the venue is reported instead of read as missing.
 */
async function getJson(url, fetchFn, sleep) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetchFn(url);
    if (res.ok) return res.json();
    if (res.status === 404) return null;
    if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const resetSeconds = Number(res.headers?.get('ratelimit-reset')) || 60;
      await sleep((resetSeconds + 1) * 1000);
      continue;
    }
    throw new Error(`http ${res.status}`);
  }
}

/**
 * Create the API client.
 * @param {typeof fetch} [fetchFn] Fetch implementation (defaults to global fetch).
 * @param {{sleep?: (ms: number) => Promise<void>}} [opts] sleep is injectable
 *   so tests do not wait out rate limits.
 * @returns {{
 *   getVenueGroup: (prefix: string, year: number, suffix?: string) => Promise<object|null>,
 *   getSubmissionDuedate: (submissionId: string) => Promise<number|null>,
 * }} `getVenueGroup` resolves to the venue group's `content` object (title,
 *   location, start_date, date, submission_id, ...) or null when the group
 *   does not exist for that year. `getSubmissionDuedate` resolves to the
 *   Submission invitation's `duedate` in ms since epoch (UTC) or null;
 *   `expired=true` is required or the API 400s once the deadline has passed.
 */
export function createApi(fetchFn = fetch, { sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  return {
    async getVenueGroup(prefix, year, suffix = 'Conference') {
      const id = `${prefix}/${year}/${suffix}`;
      const data = await getJson(`${BASE}/groups?id=${encodeURIComponent(id)}`, fetchFn, sleep);
      return data?.groups?.[0]?.content ?? null;
    },
    async getSubmissionDuedate(submissionId) {
      const data = await getJson(
        `${BASE}/invitations?id=${encodeURIComponent(submissionId)}&expired=true`,
        fetchFn,
        sleep,
      );
      return data?.invitations?.[0]?.duedate ?? null;
    },
  };
}
