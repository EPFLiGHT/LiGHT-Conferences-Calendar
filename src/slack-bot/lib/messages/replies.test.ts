import { describe, it, expect } from 'vitest';
import { buildDeadlineList, buildErrorMessage, buildHelpMessage, buildSettingsPanel } from './replies';
import { COMMANDS } from '../../config/constants';
import { conference, paperDeadline } from '@/slack-bot/testing/fixtures';

const all = (blocks: unknown[]) => JSON.stringify(blocks);

describe('buildDeadlineList (/conf-search, /conf-subject results)', () => {
  const deadlines = [{ conference: conference(), deadline: paperDeadline() }];

  it('titles the list as the caller asks', () => {
    const msg = buildDeadlineList('🔍 Search results for "pets"', 'Found 1 conference', deadlines);
    expect(msg.blocks[0]).toMatchObject({ type: 'header', text: { text: '🔍 Search results for "pets"' } });
    expect(all(msg.blocks)).toContain('Found 1 conference');
  });

  it('renders each item via the shared card', () => {
    const text = all(buildDeadlineList('Results', 'Found 1 conference', deadlines).blocks);
    expect(text).toContain('Mar 1, 2026');
    expect(text).not.toContain('23:59');
    expect(text).toContain('🌐 Website');
    expect(text).toContain('📅 Add to Calendar');
  });

  it('shows an empty-state message when there are no deadlines', () => {
    expect(all(buildDeadlineList('Results', 'Found 1 conference', []).blocks)).toContain('No upcoming deadlines');
  });
});

describe('buildHelpMessage', () => {
  it('lists every command with its usage and examples', () => {
    const text = all(buildHelpMessage().blocks);
    for (const command of COMMANDS) expect(text).toContain(command.description);
    expect(text).toContain('/conf-search <query>');
    expect(text).toContain('/conf-search CVPR');
  });
});

describe('buildSettingsPanel', () => {
  const prefs = {
    slackUserId: 'U1',
    notificationsEnabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('shows the status, the reminder days and a toggle', () => {
    const msg = buildSettingsPanel(prefs);
    const text = all(msg.blocks);
    expect(text).toContain('✅ Enabled');
    expect(text).toContain('30, 7, 3 days before');
    expect(text).toContain('disable_notifications');
    expect(text).not.toContain('edit_subjects');
    expect(all(buildSettingsPanel({ ...prefs, notificationsEnabled: false }).blocks)).toContain('enable_notifications');
  });
});

describe('buildErrorMessage', () => {
  it('puts the error in the fallback text', () => {
    expect(buildErrorMessage('boom').text).toContain('boom');
  });
});
