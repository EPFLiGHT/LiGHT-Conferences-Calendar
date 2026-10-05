import { describe, it, expect } from 'vitest';
import { buildHomeView } from './home';
import { SITE_URL } from '@/constants/routes';
import { deadlineItem, eventItem, sectionText } from '@/slack-bot/testing/fixtures';

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

const emptyHome = (enabled = false) => buildHomeView({ prefs: prefs(enabled), deadlines: [], eventStarts: [] });

describe('buildHomeView', () => {
  it('offers to turn reminders off when they are on', () => {
    const view = emptyHome(true);
    expect(view.type).toBe('home');
    expect(remindersButton(view.blocks)).toMatchObject({ action_id: 'disable_notifications', text: { text: 'Turn off' } });
    expect(sectionText(view.blocks)).toContain('Reminders are on');
  });

  it('offers to turn reminders on when they are off', () => {
    const view = emptyHome();
    expect(remindersButton(view.blocks)).toMatchObject({
      action_id: 'enable_notifications',
      text: { text: 'Turn on' },
      style: 'primary',
    });
    expect(sectionText(view.blocks)).toContain('30, 7 and 3 days before each deadline');
  });

  it('lists each deadline and event start on one line, linked to its website', () => {
    const text = sectionText(
      buildHomeView({ prefs: prefs(false), deadlines: [deadlineItem('pets', 3)], eventStarts: [eventItem('chil', 9)] })
        .blocks
    );
    expect(text).toContain('🔴 *<https://petsymposium.org|PETS 2026>*  Paper deadline · Mar 1 · 3 days left');
    expect(text).toContain('• *<https://petsymposium.org|CHIL 2026>*  Verona, Italy · Jun 22 · in 1 week');
  });

  it('keeps buttons out of the lists', () => {
    const view = buildHomeView({ prefs: prefs(false), deadlines: [deadlineItem('pets', 3)], eventStarts: [] });
    expect(view.blocks.filter((b) => b.type === 'actions')).toHaveLength(1);
  });

  it('says so when nothing is coming up', () => {
    const text = sectionText(emptyHome().blocks);
    expect(text).toContain('No upcoming deadlines right now.');
    expect(text).toContain('No upcoming events right now.');
  });

  it('links to the website and its calendar', () => {
    const all = JSON.stringify(emptyHome().blocks);
    expect(all).toContain(`"url":"${SITE_URL}"`);
    expect(all).toContain(`"url":"${SITE_URL}/calendar"`);
  });
});
