/**
 * Thin client for the public OpenReview API v2 (no auth needed). The only
 * file in the sync that touches the network; `fetch` is injectable so tests
 * never make real requests.
 */
const BASE = 'https://api2.openreview.net';

async function getJson(url, fetchFn) {
  const res = await fetchFn(url);
  if (!res.ok) return null;
  return res.json();
}

/**
 * Create the API client.
 * @param {typeof fetch} [fetchFn] Fetch implementation (defaults to global fetch).
 * @returns {{
 *   getVenueGroup: (prefix: string, year: number, suffix?: string) => Promise<object|null>,
 *   getSubmissionDuedate: (submissionId: string) => Promise<number|null>,
 * }} `getVenueGroup` resolves to the venue group's `content` object (title,
 *   location, start_date, date, submission_id, ...) or null when the group
 *   does not exist for that year. `getSubmissionDuedate` resolves to the
 *   Submission invitation's `duedate` in ms since epoch (UTC) or null;
 *   `expired=true` is required or the API 400s once the deadline has passed.
 */
export function createApi(fetchFn = fetch) {
  return {
    async getVenueGroup(prefix, year, suffix = 'Conference') {
      const id = `${prefix}/${year}/${suffix}`;
      const data = await getJson(`${BASE}/groups?id=${encodeURIComponent(id)}`, fetchFn);
      return data?.groups?.[0]?.content ?? null;
    },
    async getSubmissionDuedate(submissionId) {
      const data = await getJson(
        `${BASE}/invitations?id=${encodeURIComponent(submissionId)}&expired=true`,
        fetchFn,
      );
      return data?.invitations?.[0]?.duedate ?? null;
    },
  };
}
