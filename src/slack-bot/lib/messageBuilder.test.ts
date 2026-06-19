import { describe, it, expect } from 'vitest';
import { buildErrorMessage, formatDeadlineUrgency, formatEventCountdown, buildConferenceItemBlocks, buildUserDeadlineNotification, buildChannelDigest, buildDeadlineList, type ConferenceCardItem } from '@/slack-bot/lib/messageBuilder';
import { DateTime } from 'luxon';
import type { Conference } from '@/types/conference';

function conf(overrides: Partial<Conference> = {}): Conference {
  return {
    id: 'pets25',
    title: 'PETS',
    year: 2026,
    full_name: 'Privacy Enhancing Technologies Symposium',
    sub: 'SEC',
    type: 'conference',
    place: 'Verona, Italy',
    link: 'https://petsymposium.org',
    ...overrides,
  } as Conference;
}

function textOf(blocks: any[]): string {
  return blocks
    .filter((b) => b.type === 'section')
    .map((b) => b.text.text)
    .join('\n');
}

function buttonLabels(blocks: any[]): string[] {
  const actions = blocks.find((b) => b.type === 'actions');
  return actions ? actions.elements.map((e: any) => e.text.text) : [];
}

describe('buildConferenceItemBlocks — deadline', () => {
  const item: ConferenceCardItem = {
    kind: 'deadline',
    conference: conf(),
    deadline: {
      label: 'Paper deadline',
      datetime: DateTime.fromISO('2026-03-01T23:59:00', { zone: 'UTC-12' }),
      localDatetime: DateTime.fromISO('2026-03-01T23:59:00'),
    },
    daysLeft: 1,
  };

  it('renders date-only, urgency words, and subject emoji+word', () => {
    const blocks = buildConferenceItemBlocks(item);
    const t = textOf(blocks);
    expect(t).toContain('*PETS 2026*');
    expect(t).toContain('Mar 1, 2026');
    expect(t).not.toContain('23:59');
    expect(t).not.toContain('UTC');
    expect(t).toContain('1 day left');
    expect(t).toContain('Security'); // SUBJECT_LABELS['SEC']
  });

  it('shows Website (primary) and Add to Calendar buttons', () => {
    const blocks = buildConferenceItemBlocks(item);
    expect(buttonLabels(blocks)).toEqual(['🌐 Website', '📅 Add to Calendar']);
    const actions = blocks.find((b) => b.type === 'actions');
    expect(actions.elements[0].style).toBe('primary');
    expect(actions.elements[0].url).toBe('https://petsymposium.org');
    expect(actions.elements[1].action_id).toBe('calendar_pets25');
  });

  it('drops the Website button when there is no link', () => {
    const noLink = { ...item, conference: conf({ link: undefined }) };
    expect(buttonLabels(buildConferenceItemBlocks(noLink))).toEqual(['📅 Add to Calendar']);
  });

  it('adds a Papers button when paperslink is present', () => {
    const withPapers = { ...item, conference: conf({ paperslink: 'https://x/papers' }) };
    expect(buttonLabels(buildConferenceItemBlocks(withPapers))).toContain('📄 Papers');
  });
});

describe('buildConferenceItemBlocks — event', () => {
  const item: ConferenceCardItem = {
    kind: 'event',
    conference: conf({ sub: ['SEC', 'UNKNOWN_CODE'] }),
    start: DateTime.fromISO('2026-06-22T00:00:00'),
    daysLeft: 7,
  };

  it('renders place, date-only start, countdown, and unknown-subject fallback', () => {
    const t = textOf(buildConferenceItemBlocks(item));
    expect(t).toContain('📍 Verona, Italy');
    expect(t).toContain('Starts *Jun 22, 2026*');
    expect(t).toContain('in 1 week');
    expect(t).toContain('📌 UNKNOWN_CODE'); // fallback emoji + raw code
  });
});

describe('test infrastructure', () => {
  it('imports a builder and resolves the @/ alias', () => {
    const msg = buildErrorMessage('boom');
    expect(msg.text).toContain('boom');
  });
});

describe('formatDeadlineUrgency', () => {
  it('handles past, today, and future', () => {
    expect(formatDeadlineUrgency(-1)).toBe('Expired');
    expect(formatDeadlineUrgency(0)).toBe('Due today!');
    expect(formatDeadlineUrgency(1)).toBe('1 day left');
    expect(formatDeadlineUrgency(3)).toBe('3 days left');
    expect(formatDeadlineUrgency(14)).toBe('2 weeks left');
  });
});

describe('formatEventCountdown', () => {
  it('handles today and future', () => {
    expect(formatEventCountdown(0)).toBe('starting today');
    expect(formatEventCountdown(1)).toBe('in 1 day');
    expect(formatEventCountdown(7)).toBe('in 1 week');
  });
});

describe('buildUserDeadlineNotification', () => {
  const deadlines = [{
    conference: conf(),
    deadline: {
      label: 'Paper deadline',
      datetime: DateTime.fromISO('2026-03-01T23:59:00'),
      localDatetime: DateTime.fromISO('2026-03-01T23:59:00'),
    },
  }];

  it('uses the new title and corrected hyphenated footer', () => {
    const msg = buildUserDeadlineNotification(deadlines as any);
    const header = msg.blocks.find((b: any) => b.type === 'header') as any;
    expect(header.text.text).toBe('🔔 Your deadline reminder');
    const allText = JSON.stringify(msg.blocks);
    expect(allText).toContain('/conf-settings');
    expect(allText).toContain('/conf-unsubscribe');
    expect(allText).not.toContain(['/conf', ' settings'].join(''));
  });

  it('emits the shared card (date-only, plain urgency)', () => {
    const msg = buildUserDeadlineNotification(deadlines as any);
    const allText = JSON.stringify(msg.blocks);
    expect(allText).toContain('Mar 1, 2026');
    expect(allText).not.toContain('23:59');
  });
});

const DATE = new Date('2026-06-19T12:00:00Z');

function dl(id: string, daysLeft: number) {
  return {
    conference: conf({ id, title: id.toUpperCase() }),
    deadline: {
      label: 'Paper deadline',
      datetime: DateTime.fromISO('2026-03-01T23:59:00'),
      localDatetime: DateTime.fromISO('2026-03-01T23:59:00'),
    },
    daysLeft,
  };
}
function ev(id: string, daysLeft: number) {
  return { conference: conf({ id, title: id.toUpperCase() }), start: DateTime.fromISO('2026-06-22T00:00:00'), daysLeft };
}

describe('buildChannelDigest', () => {
  it('has the unified title, the date, and the corrected footer', () => {
    const msg = buildChannelDigest({ deadlines: [dl('pets', 1)], eventStarts: [], date: DATE });
    const header = msg.blocks.find((b: any) => b.type === 'header') as any;
    expect(header.text.text).toBe('📅 Conference Update');
    const all = JSON.stringify(msg.blocks);
    expect(all).toContain('June 19, 2026');
    expect(all).toContain('/conf-help');
    expect(all).toContain('/conf-subscribe');
  });

  it('shows only the deadline section when there are no events', () => {
    const all = JSON.stringify(buildChannelDigest({ deadlines: [dl('pets', 1)], eventStarts: [], date: DATE }).blocks);
    expect(all).toContain('Deadlines approaching');
    expect(all).not.toContain('Starting soon');
  });

  it('shows both sections when both are present', () => {
    const all = JSON.stringify(buildChannelDigest({ deadlines: [dl('pets', 1)], eventStarts: [ev('icml', 7)], date: DATE }).blocks);
    expect(all).toContain('Deadlines approaching');
    expect(all).toContain('Starting soon');
  });

  it('caps items and adds an overflow line', () => {
    const many = Array.from({ length: 12 }, (_, i) => dl(`c${i}`, i + 1));
    const all = JSON.stringify(buildChannelDigest({ deadlines: many, eventStarts: [], date: DATE, maxItems: 10 }).blocks);
    expect(all).toContain('+ 2 more');
    expect(all).toContain('/conf-upcoming');
  });

  it('builds a fallback text summary', () => {
    const msg = buildChannelDigest({ deadlines: [dl('pets', 1)], eventStarts: [ev('icml', 7)], date: DATE });
    expect(msg.text).toContain('1 deadline');
    expect(msg.text).toContain('1 event starting soon');
  });
});

describe('buildDeadlineList (/conf-search, /conf-subject results)', () => {
  const deadlines = [{
    conference: conf(),
    deadline: {
      label: 'Paper deadline',
      datetime: DateTime.fromISO('2026-03-01T23:59:00'),
      localDatetime: DateTime.fromISO('2026-03-01T23:59:00'),
    },
  }];

  it('keeps its header as the first block (so callers can slice it off)', () => {
    const msg = buildDeadlineList(deadlines as any);
    expect(msg.blocks[0].type).toBe('header');
    expect((msg.blocks[0] as any).text.text).toContain('Upcoming Conference Deadlines');
  });

  it('renders each item via the shared card (date-only, no time/zone jargon, no Details accessory)', () => {
    const all = JSON.stringify(buildDeadlineList(deadlines as any).blocks);
    expect(all).toContain('Mar 1, 2026');
    expect(all).not.toContain('23:59');
    expect(all).not.toContain('Details');
    expect(all).toContain('🌐 Website');
    expect(all).toContain('📅 Add to Calendar');
  });

  it('shows an empty-state message when there are no deadlines', () => {
    const msg = buildDeadlineList([]);
    expect(JSON.stringify(msg.blocks)).toContain('No upcoming deadlines');
  });
});
