/**
 * Centralized Vercel KV key builders for the Slack bot.
 *
 * All keys live under the `slackbot:` root so the Upstash/Vercel data
 * browser groups them together and supports prefix filtering.
 *
 * Conventions — every new key MUST fit one of these sub-namespaces:
 *
 *   slackbot:<entity>:<id>[:field]   Persistent records.
 *                                    Stored as a single JSON blob per entity
 *                                    (channel, user) or split per field
 *                                    (team:<id>:token, team:<id>:metadata).
 *                                    New fields on existing entities go INSIDE
 *                                    the blob — do not create sibling keys.
 *
 *   slackbot:cache:<name>            Long-lived caches with TTL.
 *                                    Reads are best-effort; data must be
 *                                    re-derivable from source-of-truth.
 *
 *   slackbot:state:<name>:<id>       Short-lived in-flight state with TTL.
 *                                    (OAuth nonces, modal/view state, etc.)
 *
 *   slackbot:reminder:<...>          Dedup markers with TTL just longer than
 *                                    the cron window. Presence = "already sent".
 *
 *   slackbot:idx:<name>[:by-...]     Secondary indexes (Redis sets / sorted
 *                                    sets). Used to enumerate or filter
 *                                    entities without scanning all keys.
 */

const KV_ROOT = 'slackbot';

export const kvKeys = {
  team: {
    token: (teamId: string) => `${KV_ROOT}:team:${teamId}:token`,
    metadata: (teamId: string) => `${KV_ROOT}:team:${teamId}:metadata`,
  },
  channel: {
    record: (channelId: string) => `${KV_ROOT}:channel:${channelId}`,
  },
  user: {
    record: (userId: string) => `${KV_ROOT}:user:${userId}`,
  },
  cache: {
    conferences: `${KV_ROOT}:cache:conferences`,
    conferencesTimestamp: `${KV_ROOT}:cache:conferences:ts`,
  },
  idx: {
    channel: `${KV_ROOT}:idx:channel`,
    user: `${KV_ROOT}:idx:user`,
    // Future: channelByTeam: (teamId) => `${KV_ROOT}:idx:channel:by-team:${teamId}`
  },
} as const;
