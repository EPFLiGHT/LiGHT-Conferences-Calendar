/** Once-a-day guard so a re-run cron does not repeat reminders. */

import { kv } from './kv';
import { kvKeys } from './kvKeys';

// Outlives the UTC day in the key.
const MARKER_TTL_SECONDS = 36 * 60 * 60;

/**
 * Runs send() at most once per UTC day per target, e.g. `dm:U123`. A failed
 * send releases the marker so a later run can retry.
 * @returns whether send() ran.
 */
export async function sendOncePerDay(
  target: string,
  send: () => Promise<void>
): Promise<boolean> {
  const key = kvKeys.reminder.sent(target, new Date().toISOString().slice(0, 10));
  const claimed = await kv.set(key, 1, { nx: true, ex: MARKER_TTL_SECONDS });
  if (!claimed) return false;

  try {
    await send();
  } catch (error) {
    await kv.del(key).catch(() => {});
    throw error;
  }
  return true;
}
