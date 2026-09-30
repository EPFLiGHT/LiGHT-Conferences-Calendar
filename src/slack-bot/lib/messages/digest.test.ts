import { describe, it, expect } from 'vitest';
import { buildDigest, CHANNEL_DIGEST, DM_DIGEST } from './digest';
import { deadlineItem, eventItem } from '@/slack-bot/testing/fixtures';

const DATE = new Date('2026-06-19T12:00:00Z');

const blocksText = (blocks: unknown[]) => JSON.stringify(blocks);

describe('buildDigest', () => {
  it('has the title, the date, and the footer', () => {
    const msg = buildDigest({ ...CHANNEL_DIGEST, deadlines: [deadlineItem('pets', 1)], eventStarts: [], date: DATE });
    const header = msg.blocks.find((b) => b.type === 'header') as any;
    expect(header.text.text).toBe('📅 Conference Update');
    const all = blocksText(msg.blocks);
    expect(all).toContain('June 19, 2026');
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

  it('shows both sections under a single header', () => {
    const msg = buildDigest({
      ...DM_DIGEST,
      deadlines: [deadlineItem('pets', 1)],
      eventStarts: [eventItem('icml', 7)],
      date: DATE,
    });
    const all = blocksText(msg.blocks);
    expect(all).toContain('Deadlines approaching');
    expect(all).toContain('Starting soon');
    expect(msg.blocks.filter((b) => b.type === 'header')).toHaveLength(1);
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
    const header = msg.blocks.find((b) => b.type === 'header') as any;
    expect(header.text.text).toBe('🔔 Your deadline reminder');
    const all = blocksText(msg.blocks);
    expect(all).toContain('/conf-settings');
    expect(all).toContain('/conf-unsubscribe');
    expect(all).toContain('Mar 1, 2026');
    expect(all).not.toContain('23:59');
  });

  it('says so when nothing is coming up', () => {
    const msg = buildDigest({ ...CHANNEL_DIGEST, deadlines: [], eventStarts: [], date: DATE });
    expect(blocksText(msg.blocks)).toContain('Nothing coming up');
  });
});
