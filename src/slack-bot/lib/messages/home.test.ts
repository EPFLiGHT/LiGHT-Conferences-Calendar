import { describe, it, expect } from 'vitest';
import { buildHomeView } from './home';
import { SITE_URL } from '@/constants/routes';
import { deadlineItem, eventItem } from '@/slack-bot/testing/fixtures';

const prefs = (notificationsEnabled: boolean) => ({
  slackUserId: 'U1',
  notificationsEnabled,
  createdAt: '',
  updatedAt: '',
});

const remindersButton = (blocks: unknown[]) =>
  (blocks as Array<{ accessory?: { action_id: string; text: { text: string }; style?: string } }>).find(
    (b) => b.accessory
  )?.accessory;

describe('buildHomeView', () => {
  it('offers to turn reminders off when they are on', () => {
    const view = buildHomeView({ prefs: prefs(true), deadlines: [], eventStarts: [] });
    expect(view.type).toBe('home');
    expect(remindersButton(view.blocks)).toMatchObject({ action_id: 'disable_notifications', text: { text: 'Turn off' } });
    expect(JSON.stringify(view.blocks)).toContain('✅ On.');
  });

  it('offers to turn reminders on when they are off', () => {
    const view = buildHomeView({ prefs: prefs(false), deadlines: [], eventStarts: [] });
    expect(remindersButton(view.blocks)).toMatchObject({
      action_id: 'enable_notifications',
      text: { text: 'Turn on' },
      style: 'primary',
    });
  });

  it('lists deadlines and event starts as cards', () => {
    const view = buildHomeView({
      prefs: prefs(false),
      deadlines: [deadlineItem('pets', 3)],
      eventStarts: [eventItem('chil', 9)],
    });
    const all = JSON.stringify(view.blocks);
    expect(all).toContain('Next deadlines');
    expect(all).toContain('*PETS 2026*');
    expect(all).toContain('Starting soon');
    expect(all).toContain('*CHIL 2026*');
    expect(all).toContain('📅 Add to Calendar');
  });

  it('says so when nothing is coming up', () => {
    const all = JSON.stringify(buildHomeView({ prefs: prefs(false), deadlines: [], eventStarts: [] }).blocks);
    expect(all).toContain('No upcoming deadlines right now.');
    expect(all).toContain('No upcoming events right now.');
  });

  it('links to the website and its calendar', () => {
    const all = JSON.stringify(buildHomeView({ prefs: prefs(false), deadlines: [], eventStarts: [] }).blocks);
    expect(all).toContain(`"url":"${SITE_URL}"`);
    expect(all).toContain(`"url":"${SITE_URL}/calendar"`);
  });
});
