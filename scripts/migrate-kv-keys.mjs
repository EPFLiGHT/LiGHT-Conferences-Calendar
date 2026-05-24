#!/usr/bin/env node
/**
 * One-shot migration: rename Slack-bot KV keys to the unified `slackbot:` namespace.
 *
 * Old layout (scattered):
 *   slack:team:<id>:token
 *   slack:team:<id>:metadata
 *   channel:<id>                   + set channels:all
 *   user:<id>                      + set users:all
 *   conferences:data
 *   conferences:timestamp
 *
 * New layout (grouped under slackbot:):
 *   slackbot:team:<id>:token
 *   slackbot:team:<id>:metadata
 *   slackbot:channel:<id>          + set slackbot:idx:channel
 *   slackbot:user:<id>             + set slackbot:idx:user
 *   slackbot:cache:conferences
 *   slackbot:cache:conferences:ts
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-kv-keys.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-kv-keys.mjs
 *   node --env-file=.env.local scripts/migrate-kv-keys.mjs --delete-old
 *
 * Behavior:
 *   - Default run COPIES old -> new (idempotent: skips if new already exists).
 *   - Old keys are kept until you re-run with --delete-old, so you can verify in
 *     the Vercel/Upstash console before destroying the originals.
 *   - --dry-run prints the plan without writing.
 */

import { kv } from '@vercel/kv';

const DRY_RUN = process.argv.includes('--dry-run');
const DELETE_OLD = process.argv.includes('--delete-old');

const log = (...args) => console.log('[migrate]', ...args);
const warn = (...args) => console.warn('[migrate]', ...args);

let copied = 0;
let skipped = 0;
let deleted = 0;
const oldKeysToDelete = [];

async function copyString(oldKey, newKey) {
  const existsNew = await kv.exists(newKey);
  if (existsNew) {
    log(`skip ${oldKey} -> ${newKey} (target exists)`);
    skipped++;
    oldKeysToDelete.push(oldKey);
    return;
  }
  const value = await kv.get(oldKey);
  if (value === null || value === undefined) {
    log(`skip ${oldKey} (empty)`);
    return;
  }
  log(`copy ${oldKey} -> ${newKey}`);
  if (!DRY_RUN) await kv.set(newKey, value);
  copied++;
  oldKeysToDelete.push(oldKey);
}

async function copySet(oldKey, newKey) {
  const existsNew = await kv.exists(newKey);
  const members = await kv.smembers(oldKey);
  if (!members || members.length === 0) {
    log(`skip set ${oldKey} (empty)`);
    return;
  }
  if (existsNew) {
    log(`merge set ${oldKey} (${members.length}) -> ${newKey} (already exists)`);
  } else {
    log(`copy set ${oldKey} (${members.length}) -> ${newKey}`);
  }
  if (!DRY_RUN) await kv.sadd(newKey, ...members);
  copied++;
  oldKeysToDelete.push(oldKey);
}

async function main() {
  log(DRY_RUN ? 'DRY RUN — no writes' : 'LIVE RUN');
  if (DELETE_OLD) log('Will DELETE old keys after copy.');

  // 1. Team tokens + metadata: `slack:team:*:token|metadata` -> `slackbot:team:*:...`
  const teamKeys = await kv.keys('slack:team:*');
  log(`Found ${teamKeys.length} team keys`);
  for (const oldKey of teamKeys) {
    const m = oldKey.match(/^slack:team:([^:]+):(token|metadata)$/);
    if (!m) {
      warn(`unrecognized team key: ${oldKey}`);
      continue;
    }
    const [, teamId, field] = m;
    await copyString(oldKey, `slackbot:team:${teamId}:${field}`);
  }

  // 2. Channels: `channel:<id>` -> `slackbot:channel:<id>` (skip `channels:all` here)
  const channelKeys = (await kv.keys('channel:*')).filter(k => !k.startsWith('channels:'));
  log(`Found ${channelKeys.length} channel record keys`);
  for (const oldKey of channelKeys) {
    const id = oldKey.slice('channel:'.length);
    await copyString(oldKey, `slackbot:channel:${id}`);
  }
  // 2b. channels:all (set) -> slackbot:idx:channel
  await copySet('channels:all', 'slackbot:idx:channel');

  // 3. Users: `user:<id>` -> `slackbot:user:<id>` (skip `users:all` here)
  const userKeys = (await kv.keys('user:*')).filter(k => !k.startsWith('users:'));
  log(`Found ${userKeys.length} user record keys`);
  for (const oldKey of userKeys) {
    const id = oldKey.slice('user:'.length);
    await copyString(oldKey, `slackbot:user:${id}`);
  }
  // 3b. users:all (set) -> slackbot:idx:user
  await copySet('users:all', 'slackbot:idx:user');

  // 4. Conference cache
  await copyString('conferences:data', 'slackbot:cache:conferences');
  await copyString('conferences:timestamp', 'slackbot:cache:conferences:ts');

  log(`Summary: copied=${copied} skipped=${skipped} oldKeysQueued=${oldKeysToDelete.length}`);

  if (DELETE_OLD && !DRY_RUN) {
    for (const oldKey of oldKeysToDelete) {
      await kv.del(oldKey);
      deleted++;
    }
    log(`Deleted ${deleted} old keys.`);
  } else if (oldKeysToDelete.length > 0) {
    log('Old keys NOT deleted. Re-run with --delete-old once you verify the new keys.');
  }
}

main().catch(err => {
  console.error('[migrate] FAILED:', err);
  process.exit(1);
});
