/** The daily reminder run shared by the DM and channel crons. */

import { filterDeadlinesByReminders, getEventStartsOnDays } from '@/utils/conferenceQueries';
import { getConferences } from './conferences';
import { buildDigest, type DigestStyle } from './messages/digest';
import { postMessage } from './slackClient';
import { sendOncePerDay } from './reminderDedup';
import { classifySlackError } from './slackErrors';
import { purgeTeam } from './purgeTeam';
import { getTeamToken } from './teamStorage';
import { logger } from './logger';

export interface ReminderTarget {
  /** Channel ID, or user ID for a DM. */
  channel: string;
  /** Once-a-day dedup key, e.g. `dm:U123`. */
  key: string;
  teamId?: string;
}

export interface ReminderSummary {
  deadlines: number;
  eventStarts: number;
  targets: number;
  sent: number;
  /** Already sent today, or the workspace was found gone earlier in this run. */
  skipped: number;
  failed: number;
  errors?: string[];
}

/**
 * Sends today's digest to every target at most once per day. A workspace Slack reports as gone is
 * purged and a gone target dropped; other failures are counted and retried on the next run.
 */
export async function runReminderJob(job: {
  name: string;
  reminderDays: readonly number[];
  digest: DigestStyle;
  loadTargets: () => Promise<ReminderTarget[]>;
  dropTarget: (target: ReminderTarget) => Promise<unknown>;
}): Promise<ReminderSummary> {
  const conferences = await getConferences();
  const deadlines = filterDeadlinesByReminders(conferences, [...job.reminderDays]);
  const eventStarts = getEventStartsOnDays(conferences, [...job.reminderDays]);
  const summary: ReminderSummary = {
    deadlines: deadlines.length,
    eventStarts: eventStarts.length,
    targets: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  };
  if (deadlines.length === 0 && eventStarts.length === 0) {
    logger.info('Nothing to remind today', { job: job.name, reminderDays: job.reminderDays });
    return summary;
  }

  const message = buildDigest({ ...job.digest, deadlines, eventStarts, date: new Date() });
  const targets = await job.loadTargets();
  summary.targets = targets.length;
  const goneTeams = new Set<string>();
  const errors: string[] = [];

  for (const target of targets) {
    // SLACK_BOT_TOKEN targets have no team ID and share one token.
    const team = target.teamId ?? 'default';
    if (goneTeams.has(team)) {
      summary.skipped++;
      continue;
    }

    try {
      const sent = await sendOncePerDay(target.key, () => postMessage(target.channel, message, target.teamId));
      if (sent) summary.sent++;
      else summary.skipped++;
    } catch (error) {
      summary.failed++;
      errors.push(`${target.key}: ${error instanceof Error ? error.message : String(error)}`);
      const failure = classifySlackError(error);
      logger.error('Reminder failed', { job: job.name, target: target.key, teamId: target.teamId, failure, error });

      try {
        if (failure === 'team_gone') {
          goneTeams.add(team);
          // A revoked SLACK_BOT_TOKEN is a config problem, not an uninstall: only OAuth installs are purged.
          if (target.teamId && (await getTeamToken(target.teamId))) await purgeTeam(target.teamId);
        } else if (failure === 'target_gone') {
          await job.dropTarget(target);
        }
      } catch (cleanupError) {
        logger.error('Reminder cleanup failed', { job: job.name, target: target.key, error: cleanupError });
      }
    }
  }

  logger.info('Reminder job finished', { job: job.name, ...summary });
  return errors.length > 0 ? { ...summary, errors } : summary;
}
