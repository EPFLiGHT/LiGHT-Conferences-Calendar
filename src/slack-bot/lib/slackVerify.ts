/**
 * Slack Request Verification
 * Verifies that requests are actually from Slack using signature validation
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * Verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackRequest(
  headers: Headers,
  body: string
): Promise<boolean> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;

  if (!signingSecret) {
    logger.error('SLACK_SIGNING_SECRET not configured');
    return false;
  }

  const slackSignature = headers.get('x-slack-signature');
  const slackTimestamp = headers.get('x-slack-request-timestamp');

  if (!slackSignature || !slackTimestamp) {
    logger.warn('Missing Slack signature or timestamp headers');
    return false;
  }

  // Verify timestamp is recent (within 5 minutes)
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = Math.abs(currentTime - parseInt(slackTimestamp, 10));

  if (timeDiff > 60 * 5) {
    logger.warn('Slack request timestamp too old', { timeDiff });
    return false;
  }

  // Compute signature
  const sigBasestring = `v0:${slackTimestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(sigBasestring);
  const computedSignature = `v0=${hmac.digest('hex')}`;

  // crypto.timingSafeEqual throws on length mismatch - short-circuit cleanly.
  const computedBuf = Buffer.from(computedSignature);
  const receivedBuf = Buffer.from(slackSignature);
  if (computedBuf.length !== receivedBuf.length) {
    logger.warn('Invalid Slack signature (length mismatch)');
    return false;
  }

  const isValid = crypto.timingSafeEqual(computedBuf, receivedBuf);
  if (!isValid) {
    logger.warn('Invalid Slack signature');
  }
  return isValid;
}

/**
 * Extract Slack command parameters from form-encoded body
 */
export function parseSlackCommand(body: string): Record<string, string> {
  const params = new URLSearchParams(body);
  return {
    token: params.get('token') || '',
    team_id: params.get('team_id') || '',
    user_id: params.get('user_id') || '',
    user_name: params.get('user_name') || '',
    command: params.get('command') || '',
    text: params.get('text') || '',
    response_url: params.get('response_url') || '',
    trigger_id: params.get('trigger_id') || '',
    channel_id: params.get('channel_id') || '',
  };
}
