/** Block Kit shorthands shared by the message builders. */

import type { ContextBlock, DividerBlock, HeaderBlock, SectionBlock } from '@slack/web-api';

// Slack rejects header text longer than 150 characters.
const HEADER_MAX = 150;

export const header = (text: string): HeaderBlock => ({
  type: 'header',
  text: { type: 'plain_text', text: Array.from(text).slice(0, HEADER_MAX).join(''), emoji: true },
});

export const section = (text: string): SectionBlock => ({ type: 'section', text: { type: 'mrkdwn', text } });

export const context = (text: string): ContextBlock => ({ type: 'context', elements: [{ type: 'mrkdwn', text }] });

export const divider: DividerBlock = { type: 'divider' };

export const plural = (count: number, one: string, many = `${one}s`): string =>
  `${count} ${count === 1 ? one : many}`;
