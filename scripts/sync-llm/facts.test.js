import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { resolveZone, parseDeadline, editionToFacts } from './facts.js';
import { edition } from './test-helpers.js';

describe('resolveZone', () => {
  it('maps AoE variants to UTC-12', () => {
    expect(resolveZone('AoE')).toBe('UTC-12');
    expect(resolveZone('anywhere on earth')).toBe('UTC-12');
  });

  // Every entry of FIXED_OFFSETS: the table is trusted over Luxon, so a typo
  // here would silently store deadlines hours off.
  it.each([
    ['EDT', 'UTC-4'], ['CDT', 'UTC-5'], ['MDT', 'UTC-6'], ['PDT', 'UTC-7'],
    ['CEST', 'UTC+2'], ['BST', 'UTC+1'], ['AEST', 'UTC+10'], ['AEDT', 'UTC+11'],
  ])('pins %s, which Luxon rejects or misreads, to %s', (text, zone) => {
    expect(resolveZone(text)).toBe(zone);
    expect(resolveZone(text.toLowerCase())).toBe(zone);
  });

  it('overrides BST, which Luxon resolves to Bangladesh (UTC+6), not Britain', () => {
    expect(DateTime.now().setZone('BST').offset / 60).toBe(6);
    expect(resolveZone('BST')).toBe('UTC+1');
  });

  // Standard-time names must stay OUT of the table: Luxon resolves them through
  // DST, so pinning them to their winter offset breaks every summer deadline.
  it.each(['PST', 'CST', 'CET', 'EST', 'MST', 'GMT', 'UTC'])(
    'defers %s to Luxon rather than pinning it', (text) => {
      expect(resolveZone(text)).toBe(text);
    });

  it('keeps a summer CET deadline on CEST, as Luxon reads it', () => {
    const dt = parseDeadline({ date: '2026-07-15', time: '23:59', timezone_text: 'CET' }, 'UTC');
    expect(dt.toISO()).toBe('2026-07-15T21:59:00.000Z');
  });

  it('keeps valid IANA zone text', () => {
    expect(resolveZone('America/New_York')).toBe('America/New_York');
  });

  // US pages rarely write an IANA name; map the common spellings to locations
  // (not offsets) so a date still resolves through DST on its own.
  it.each([
    ['PT', 'America/Los_Angeles'], ['Pacific Time', 'America/Los_Angeles'],
    ['ET', 'America/New_York'], ['Eastern Time', 'America/New_York'],
    ['CT', 'America/Chicago'], ['Central Time', 'America/Chicago'],
    ['MT', 'America/Denver'], ['Mountain Time', 'America/Denver'],
  ])('maps the US name %s to %s', (text, zone) => {
    expect(resolveZone(text)).toBe(zone);
    expect(resolveZone(text.toLowerCase())).toBe(zone);
  });

  it('does not read Central European Time as US Central', () => {
    expect(resolveZone('Central European Time')).toBeNull();
  });

  it('returns null rather than guessing an unrecognized zone', () => {
    expect(resolveZone('local Toronto, Canadian Time')).toBeNull();
    expect(resolveZone('Klingon Standard')).toBeNull();
    expect(resolveZone(null)).toBeNull();
  });
});

describe('parseDeadline', () => {
  it('defaults time to 23:59 in the resolved zone, returned as UTC', () => {
    const dt = parseDeadline({ date: '2026-09-15', time: null, timezone_text: 'AoE' }, 'UTC');
    expect(dt.toISO()).toBe('2026-09-16T11:59:00.000Z');
  });
  it('returns null for garbage dates', () => {
    expect(parseDeadline({ date: 'soon', time: null, timezone_text: null }, 'UTC')).toBeNull();
  });
});

describe('editionToFacts', () => {
  it('maps abstract and paper deadlines into merge.js facts', () => {
    const e = edition({ start_date: '2026-11-10', end_date: '2026-11-12' });
    e.deadlines.push({ kind: 'abstract', date: '2026-08-01', time: '12:00', timezone_text: 'UTC',
      evidence: 'x' });
    e.location = 'Kigali, Rwanda';
    const facts = editionToFacts(e, 'UTC-12');
    expect(facts.location).toBe('Kigali, Rwanda');
    expect(facts.startIso).toBe('2026-11-10');
    expect(facts.endIso).toBe('2026-11-12');
    expect(facts.deadline.toISO()).toBe('2026-09-16T11:59:00.000Z');
    expect(facts.abstractDeadline.toISO()).toBe('2026-08-01T12:00:00.000Z');
  });
});
