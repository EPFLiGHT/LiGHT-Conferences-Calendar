import { describe, it, expect } from 'vitest';
import { buildDigest, CHANNEL_DIGEST, DM_DIGEST } from './digest';
import { conference, deadlineItem, eventItem, typedDeadlineItem as item } from '@/slack-bot/testing/fixtures';

const DATE = new Date('2026-06-19T12:00:00Z');

const blocksText = (blocks: unknown[]) => JSON.stringify(blocks);

describe('buildDigest', () => {
  it('puts two deadlines of one event in one card and still counts both', () => {
    const a = conference({ id: 'a26', title: 'A' });
    const msg = buildDigest({ ...CHANNEL_DIGEST, deadlines: [item(a, 'poster', 7), item(a, 'grant', 7)], eventStarts: [], date: new Date('2026-09-08') });
    expect(msg.blocks.filter((b) => b.type === 'actions')).toHaveLength(1);
    expect(msg.text).toBe('📅 Conference Update: 2 deadlines');
  });

  it('opens with the first section title, then the date, and ends with the footer', () => {
    const msg = buildDigest({ ...CHANNEL_DIGEST, deadlines: [deadlineItem('pets', 1)], eventStarts: [], date: DATE });
    expect(msg.blocks[0]).toMatchObject({ type: 'header', text: { text: '⏳ Deadlines approaching' } });
    expect(blocksText([msg.blocks[1]])).toContain('June 19, 2026');
    expect(msg.text).toBe('📅 Conference Update: 1 deadline');
    const all = blocksText(msg.blocks);
    expect(all).not.toContain('Conference Update');
    expect(all).toContain('/conf-help');
    expect(all).toContain('/conf-subscribe');
  });

  it('shows only the deadline section when there are no events', () => {
    const all = blocksText(
      buildDigest({ ...CHANNEL_DIGEST, deadlines: [deadlineItem('pets', 1)], eventStarts: [], date: DATE }).blocks
    );
    expect(all).toContain('Deadlines approaching');
    expect(all).not.toContain('Starting soon');
  });

  it('gives each section its own header', () => {
    const msg = buildDigest({
      ...DM_DIGEST,
      deadlines: [deadlineItem('pets', 1)],
      eventStarts: [eventItem('icml', 7)],
      date: DATE,
    });
    const headers = msg.blocks.filter((b) => b.type === 'header').map((b: any) => b.text.text);
    expect(headers).toEqual(['⏳ Deadlines approaching', '🎟️ Starting soon']);
  });

  it('puts the date under the starting-soon header when no deadline is due', () => {
    const msg = buildDigest({ ...CHANNEL_DIGEST, deadlines: [], eventStarts: [eventItem('icml', 7)], date: DATE });
    expect(msg.blocks[0]).toMatchObject({ type: 'header', text: { text: '🎟️ Starting soon' } });
    expect(blocksText([msg.blocks[1]])).toContain('June 19, 2026');
  });

  it('caps items and adds an overflow line', () => {
    const many = Array.from({ length: 12 }, (_, i) => deadlineItem(`c${i}`, i + 1));
    const all = blocksText(
      buildDigest({ ...CHANNEL_DIGEST, deadlines: many, eventStarts: [], date: DATE, maxItems: 10 }).blocks
    );
    expect(all).toContain('+ 2 more');
    expect(all).toContain('/conf-upcoming');
  });

  it('stays within the Slack block limit on a busy day', () => {
    const deadlines = Array.from({ length: 12 }, (_, i) => deadlineItem(`d${i}`, 7));
    const eventStarts = Array.from({ length: 12 }, (_, i) => eventItem(`e${i}`, 7));
    const msg = buildDigest({ ...DM_DIGEST, deadlines, eventStarts, date: DATE });
    expect(msg.blocks.length).toBeLessThanOrEqual(50);
    const all = blocksText(msg.blocks);
    const shown = (prefix: string) => (all.match(new RegExp(`"ics_${prefix}\\d+"`, 'g')) ?? []).length;
    expect(shown('d')).toBeGreaterThan(0);
    expect(all).toContain(`+ ${12 - shown('d')} more`);
    expect(all).toContain(`+ ${12 - shown('e')} more`);
  });

  it('builds a fallback text summary', () => {
    const msg = buildDigest({
      ...CHANNEL_DIGEST,
      deadlines: [deadlineItem('pets', 1)],
      eventStarts: [eventItem('icml', 7)],
      date: DATE,
    });
    expect(msg.text).toContain('1 deadline');
    expect(msg.text).toContain('1 event starting soon');
  });

  it('uses the DM title and settings footer for DMs', () => {
    const msg = buildDigest({ ...DM_DIGEST, deadlines: [deadlineItem('pets', 1)], eventStarts: [], date: DATE });
    expect(msg.text).toBe('🔔 Your deadline reminder: 1 deadline');
    const all = blocksText(msg.blocks);
    expect(all).toContain('/conf-settings');
    expect(all).toContain('/conf-unsubscribe');
    expect(all).toContain('Mar 1, 2026');
    expect(all).not.toContain('23:59');
  });

  it('says so when nothing is coming up', () => {
    const msg = buildDigest({ ...CHANNEL_DIGEST, deadlines: [], eventStarts: [], date: DATE });
    expect(msg.blocks[0]).toMatchObject({ type: 'header', text: { text: '📅 Conference Update' } });
    expect(blocksText(msg.blocks)).toContain('Nothing coming up');
  });
});
