import { describe, it, expect } from 'vitest';
import { buildResultList, buildErrorMessage, buildHelpMessage, buildSettingsPanel } from './replies';
import { COMMANDS } from '../../config/constants';
import { deadlineCard, eventItem } from '@/slack-bot/testing/fixtures';

const all = (blocks: unknown[]) => JSON.stringify(blocks);

describe('buildResultList (/conf-search, /conf-subject results)', () => {
  const items = [deadlineCard('pets25', 5)];

  it('titles the list as the caller asks', () => {
    const msg = buildResultList('🔍 Search results for "pets"', 'Found 1 conference', items);
    expect(msg.blocks[0]).toMatchObject({ type: 'header', text: { text: '🔍 Search results for "pets"' } });
    expect(all(msg.blocks)).toContain('Found 1 conference');
  });

  it('renders each item via the shared card', () => {
    const text = all(buildResultList('Results', 'Found 1 conference', items).blocks);
    expect(text).toContain('Mar 1, 2026');
    expect(text).not.toContain('23:59');
    expect(text).toContain('🌐 Website');
    expect(text).toContain('📅 Add to Calendar');
  });

  it('renders an event with no open deadline by its start date', () => {
    const text = all(buildResultList('Results', 'Found 1 conference', [{ kind: 'event', ...eventItem('gais27', 214) }]).blocks);
    expect(text).toContain('GAIS27');
    expect(text).toContain('Starts *Jun 22, 2026*');
  });

  it('shows an empty-state message when nothing is upcoming', () => {
    expect(all(buildResultList('Results', 'Found 1 conference', []).blocks)).toContain('Nothing upcoming');
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
