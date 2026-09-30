import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateTime } from 'luxon';
import {
  buildConferenceCard,
  buildConferenceDetails,
  cardList,
  formatDeadlineUrgency,
  formatEventCountdown,
  type ConferenceCardItem,
} from './cards';
import { conference, deadlineItem, sectionText } from '@/slack-bot/testing/fixtures';

function buttons(blocks: any[]): any[] {
  return blocks.find((b) => b.type === 'actions')?.elements ?? [];
}

describe('buildConferenceCard: deadline', () => {
  const item: ConferenceCardItem = {
    kind: 'deadline',
    conference: conference(),
    deadline: {
      kind: 'paper',
      label: 'Paper deadline',
      datetime: DateTime.fromISO('2026-03-01T23:59:00', { zone: 'UTC-12' }),
      localDatetime: DateTime.fromISO('2026-03-01T23:59:00'),
    },
    daysLeft: 1,
  };

  beforeEach(() => {
    vi.stubEnv('APP_URL', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders date-only, urgency words, and subject emoji+word', () => {
    const t = sectionText(buildConferenceCard(item));
    expect(t).toContain('*PETS 2026*');
    expect(t).toContain('Mar 1, 2026');
    expect(t).not.toContain('23:59');
    expect(t).not.toContain('UTC');
    expect(t).toContain('1 day left');
    expect(t).toContain('Security');
  });

  it('shows Website (primary) and an Add to Calendar download link', () => {
    const [website, calendar] = buttons(buildConferenceCard(item));
    expect(website).toMatchObject({ style: 'primary', url: 'https://petsymposium.org' });
    expect(website.text.text).toBe('🌐 Website');
    expect(calendar.text.text).toBe('📅 Add to Calendar');
    expect(calendar.url).toBe('https://conferences-calendar.vercel.app/api/calendar/pets25');
    expect(calendar.action_id).not.toMatch(/^calendar_/);
  });

  it('drops the Website button when there is no link', () => {
    const noLink = { ...item, conference: conference({ link: undefined }) };
    expect(buttons(buildConferenceCard(noLink)).map((b) => b.text.text)).toEqual(['📅 Add to Calendar']);
  });

  it('adds a Papers button when paperslink is present', () => {
    const withPapers = { ...item, conference: conference({ paperslink: 'https://x/papers' }) };
    expect(buttons(buildConferenceCard(withPapers)).map((b) => b.text.text)).toContain('📄 Papers');
  });
});

describe('buildConferenceCard: event', () => {
  it('renders place, date-only start, countdown, and unknown-subject fallback', () => {
    const t = sectionText(
      buildConferenceCard({
        kind: 'event',
        conference: conference({ sub: ['SEC', 'UNKNOWN_CODE'] }),
        start: DateTime.fromISO('2026-06-22T00:00:00'),
        daysLeft: 7,
      })
    );
    expect(t).toContain('📍 Verona, Italy');
    expect(t).toContain('Starts *Jun 22, 2026*');
    expect(t).toContain('in 1 week');
    expect(t).toContain('📌 UNKNOWN_CODE');
  });
});

describe('cardList', () => {
  it('separates cards with dividers', () => {
    const items = ['a', 'b', 'c'].map((id) => ({ kind: 'deadline' as const, ...deadlineItem(id, 3) }));
    const types = cardList(items).map((b) => b.type);
    expect(types).toEqual(['section', 'actions', 'divider', 'section', 'actions', 'divider', 'section', 'actions']);
  });
});

describe('buildConferenceDetails', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-02-01T00:00:00Z'), toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the card plus full name, place and note', () => {
    const msg = buildConferenceDetails(conference({ deadline: '2026-03-01 12:00', note: 'Hybrid' }));
    const all = JSON.stringify(msg.blocks);
    expect(all).toContain('Mar 1, 2026');
    expect(all).toContain('Privacy Enhancing Technologies Symposium');
    expect(all).toContain('📍 Verona, Italy');
    expect(all).toContain('ℹ️ Hybrid');
  });

  it('explains a missing deadline', () => {
    const msg = buildConferenceDetails(conference({ deadline_status: 'tba' }));
    expect(msg.text).toBe('PETS 2026 - Deadline to be announced');
  });
});

describe('formatDeadlineUrgency', () => {
  it('handles past, today, and future', () => {
    expect(formatDeadlineUrgency(-1)).toBe('Expired');
    expect(formatDeadlineUrgency(0)).toBe('Due today!');
    expect(formatDeadlineUrgency(1)).toBe('1 day left');
    expect(formatDeadlineUrgency(3)).toBe('3 days left');
    expect(formatDeadlineUrgency(14)).toBe('2 weeks left');
    expect(formatDeadlineUrgency(45)).toBe('1 month left');
  });
});

describe('formatEventCountdown', () => {
  it('handles today and future', () => {
    expect(formatEventCountdown(0)).toBe('starting today');
    expect(formatEventCountdown(1)).toBe('in 1 day');
    expect(formatEventCountdown(7)).toBe('in 1 week');
  });
});

