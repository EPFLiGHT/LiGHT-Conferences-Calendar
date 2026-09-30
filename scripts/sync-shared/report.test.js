import { describe, it, expect } from 'vitest';
import { renderReport, emptyOutcome, addOutcome } from './report.js';

const title = 'Test sync report';

describe('renderReport', () => {
  it('says so when nothing changed', () => {
    const md = renderReport({ title, updates: [], drafts: [], flags: [], skipped: [] });
    expect(md).toContain('No changes.');
  });

  it('renders updates as a table plus drafts and flags as lists', () => {
    const md = renderReport({
      title,
      updates: [{ id: 'colm26', field: 'deadline', old: '2026-04-01 23:59', new: '2026-04-01 00:15' }],
      drafts: [{ id: 'colm27', title: 'COLM', year: 2027 }],
      flags: ['colm27: no end date from the source yet; set end and date by hand'],
      skipped: ['SaTML 2026: request failed (network)'],
    });
    expect(md).toContain('| colm26 | deadline | 2026-04-01 23:59 | 2026-04-01 00:15 |');
    expect(md).toContain('- colm27 (COLM 2027)');
    expect(md).toContain('### Needs attention');
    expect(md).toContain('### Skipped');
    expect(md).not.toContain('No changes.');
  });

  it('prints an identical flag only once', () => {
    // A venue page listing two same-year editions flags the same pin twice.
    const flag = 'embc26: full_name pinned; source reports IEEE EMBC 2026';
    const md = renderReport({ title, flags: [flag, flag] });
    expect(md.match(/full_name pinned/g)).toHaveLength(1);
  });

  it('uses the title as the heading', () => {
    expect(renderReport({ title: 'LLM web sync report' }).startsWith('## LLM web sync report')).toBe(true);
  });
});

describe('addOutcome', () => {
  it('appends every list and tolerates missing ones', () => {
    const run = emptyOutcome();
    addOutcome(run, { flags: ['a'], skipped: ['b'] });
    addOutcome(run, { updates: [{ id: 'x' }], flags: ['c'] });
    expect(run).toEqual({ updates: [{ id: 'x' }], drafts: [], flags: ['a', 'c'], skipped: ['b'] });
  });
});
