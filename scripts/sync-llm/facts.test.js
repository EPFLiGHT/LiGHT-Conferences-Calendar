import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { resolveZone, parseDeadline, validateEditions, editionToFacts, bigMoveFlags } from './facts.js';

const TODAY = DateTime.fromISO('2026-07-08T12:00:00Z', { zone: 'utc' });

function edition(overrides = {}) {
  return {
    year: 2026, full_name: null, location: null, start_date: '2026-11-10', end_date: null,
    deadlines: [{ kind: 'paper', date: '2026-09-15', time: null, timezone_text: null,
      evidence: 'Paper deadline: September 15, 2026' }],
    ...overrides,
  };
}

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

describe('validateEditions', () => {
  const pageText = 'Important dates. Paper deadline: September 15, 2026. Venue: Kigali.';

  it('passes a clean edition through', () => {
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [edition()] }, { pageText, today: TODAY });
    expect(editions).toHaveLength(1);
    expect(editions[0].deadlines).toHaveLength(1);
    expect(flags).toEqual([]);
  });

  it('drops deadlines whose evidence is not on the page (hallucination/injection guard)', () => {
    const bad = edition();
    bad.deadlines[0].evidence = 'Deadline: October 1, 2026 (fabricated)';
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [bad] }, { pageText, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/evidence not found/);
  });

  it('normalizes whitespace and case when matching evidence', () => {
    const e = edition();
    e.deadlines[0].evidence = 'paper   deadline:  september 15, 2026';
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
  });

  it('drops a date whose evidence names no submission (travel grant, registration)', () => {
    const page = 'Important dates. 30 April 26: Gertrud Meissner application deadline.';
    const e = edition();
    e.deadlines[0].date = '2026-04-30';
    e.deadlines[0].evidence = '30 April 26: Gertrud Meissner application deadline';
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/names no submission/);
  });

  it('keeps a submission deadline that shares its line with a grant deadline', () => {
    const page = 'Dates. 10 May 26: Abstract deadline and travel grant applications EXTENDED DATE.';
    const e = edition({ start_date: '2026-06-22' });
    e.deadlines[0] = {
      kind: 'abstract', date: '2026-05-10', time: null, timezone_text: null,
      evidence: '10 May 26: Abstract deadline and travel grant applications EXTENDED DATE',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
    expect(flags).toEqual([]);
  });

  it('matches plural submission words', () => {
    const page = 'The call for abstracts will be open from July 1 to September 1, 2026.';
    const e = edition({ start_date: '2026-11-10' });
    e.deadlines[0] = {
      kind: 'abstract', date: '2026-09-01', time: null, timezone_text: null,
      evidence: 'The call for abstracts will be open from July 1 to September 1, 2026.',
    };
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
  });

  it('drops a date the quote does not state (month only, or no date at all)', () => {
    const page = 'Abstract Submission Deadline April 2026. Full paper submission deadline: Closed.';
    const vague = edition({ start_date: '2026-10-06' });
    vague.deadlines[0] = {
      kind: 'abstract', date: '2026-04-01', time: null, timezone_text: null,
      evidence: 'Abstract Submission Deadline April 2026',
    };
    const closed = edition({ start_date: '2026-10-06' });
    closed.deadlines[0] = {
      kind: 'paper', date: '2026-04-15', time: null, timezone_text: null,
      evidence: 'Full paper submission deadline: Closed.',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [vague, closed] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(editions[1].deadlines).toHaveLength(0);
    expect(flags.every((f) => /does not state this date/.test(f))).toBe(true);
  });

  it('accepts a two-digit year and a day-first date', () => {
    const page = '10 May 26: Abstract deadline.';
    const e = edition({ start_date: '2026-06-22' });
    e.deadlines[0] = {
      kind: 'abstract', date: '2026-05-10', time: null, timezone_text: null,
      evidence: '10 May 26: Abstract deadline',
    };
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
  });

  it('keeps an abstract registration deadline (a submission, despite the word registration)', () => {
    const page = 'Paper Abstract Registration (Intention to Submit) Thursday, February 12, 2026';
    const e = edition({ start_date: '2026-10-06' });
    e.deadlines[0] = {
      kind: 'abstract', date: '2026-02-12', time: null, timezone_text: null,
      evidence: 'Paper Abstract Registration (Intention to Submit) Thursday, February 12, 2026',
    };
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
  });

  it('drops post-submission dates even when they say "paper"', () => {
    const page = 'October 1, 2026 Camera-ready accepted paper deadline. September 8, 2026 Notification of paper acceptance.';
    const e = edition({ start_date: '2027-01-03', year: 2026 });
    e.deadlines[0] = {
      kind: 'paper', date: '2026-10-01', time: null, timezone_text: null,
      evidence: 'October 1, 2026 Camera-ready accepted paper deadline',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/names no submission/);
  });

  it('corrects the kind when the evidence contradicts the model', () => {
    const page = '10 May 26: Abstract deadline and travel grant applications.';
    const e = edition({ start_date: '2026-06-22' });
    e.deadlines[0] = {
      kind: 'paper', date: '2026-05-10', time: null, timezone_text: null,
      evidence: '10 May 26: Abstract deadline and travel grant applications',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines[0].kind).toBe('abstract');
    expect(flags[0]).toMatch(/reported as paper.*reads as abstract/);
  });

  it('keeps the model kinds when the evidence override would collide', () => {
    const page = 'Paper registration: February 1, 2026. Full paper submission: March 1, 2026.';
    const e = edition({ start_date: '2026-06-22' });
    e.deadlines = [
      { kind: 'abstract', date: '2026-02-01', time: null, timezone_text: null,
        evidence: 'Paper registration: February 1, 2026' },
      { kind: 'paper', date: '2026-03-01', time: null, timezone_text: null,
        evidence: 'Full paper submission: March 1, 2026' },
    ];
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines.map((d) => d.kind)).toEqual(['abstract', 'paper']);
    const facts = editionToFacts(editions[0], 'UTC');
    expect(facts.abstractDeadline.toISODate()).toBe('2026-02-01');
    expect(facts.deadline.toISODate()).toBe('2026-03-01');
    expect(flags.some((f) => /kept its labels, check which row is which/.test(f))).toBe(true);
  });

  it('never blesses the model labels silently when the evidence disagrees with both', () => {
    const page = 'Full paper submission 10 January 2026. Paper submission 20 January 2026.';
    const e = edition({ start_date: '2026-06-22' });
    e.deadlines = [
      { kind: 'abstract', date: '2026-01-10', time: null, timezone_text: null,
        evidence: 'Full paper submission 10 January 2026' },
      { kind: 'paper', date: '2026-01-20', time: null, timezone_text: null,
        evidence: 'Paper submission 20 January 2026' },
    ];
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] },
      { pageText: page, today: DateTime.fromISO('2025-12-01T00:00:00Z', { zone: 'utc' }) });
    expect(editions[0].deadlines.map((d) => d.kind)).toEqual(['abstract', 'paper']);
    expect(flags.some((f) => /evidence for every deadline reads as "paper"/.test(f))).toBe(true);
  });

  it('drops a second deadline of the same kind rather than letting it be lost silently', () => {
    const page = 'Paper deadline: September 15, 2026. Paper deadline: September 20, 2026.';
    const e = edition();
    e.deadlines = [
      { kind: 'paper', date: '2026-09-15', time: null, timezone_text: null,
        evidence: 'Paper deadline: September 15, 2026' },
      { kind: 'paper', date: '2026-09-20', time: null, timezone_text: null,
        evidence: 'Paper deadline: September 20, 2026' },
    ];
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
    expect(flags.some((f) => /already recorded/.test(f))).toBe(true);
  });

  // A month token that swallows a following suffix turns ordinary prose into
  // evidence for a date the page never states.
  it.each([
    ['2026-05-05', 'Submit papers by 5 maybe 2026 is our aim'],
    ['2026-03-03', 'The marathon 3 2026 paper route is published'],
    ['2026-12-05', 'Decision 5 2026 on submitted papers will follow'],
    ['2026-09-05', 'A separate 5 2026 paper track is planned'],
  ])('does not let an English word stand in for the month of %s', (date, evidence) => {
    const e = edition({ start_date: null });
    e.deadlines[0] = { kind: 'paper', date, time: null, timezone_text: null, evidence };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: evidence, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/does not state this date/);
  });

  it('requires a two-digit year to sit beside the date, not loose in the text', () => {
    const page = 'Paper deadline March 15 Room 26';
    const e = edition({ start_date: '2026-10-06' });
    e.deadlines[0] = {
      kind: 'paper', date: '2026-03-15', time: null, timezone_text: null,
      evidence: 'Paper deadline March 15 Room 26',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/does not state this date/);
  });

  it('drops a day the quote never states, even when the number appears elsewhere', () => {
    const page = 'Papers due in November 2026 (see item 1).';
    const e = edition({ start_date: '2026-12-10' });
    e.deadlines[0] = {
      kind: 'paper', date: '2026-11-01', time: null, timezone_text: null,
      evidence: 'Papers due in November 2026 (see item 1)',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/does not state this date/);
  });

  it('flags an unrecognized timezone instead of silently using the entry zone', () => {
    const page = 'Paper deadline: September 15, 2026 at 5:00pm local Toronto time.';
    const e = edition();
    e.deadlines[0].evidence = 'Paper deadline: September 15, 2026 at 5:00pm local Toronto time';
    e.deadlines[0].timezone_text = 'local Toronto time';
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
    expect(flags[0]).toMatch(/timezone "local Toronto time" is not recognized/);
  });

  it('drops a start_date that is not a plain calendar date', () => {
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [edition({ start_date: '2026-11-10T00:00' })] },
      { pageText, today: TODAY });
    expect(editions[0].start_date).toBeNull();
    expect(flags.some((f) => /not a real YYYY-MM-DD date/.test(f))).toBe(true);
  });

  it('keeps the model kind when the evidence names both', () => {
    const page = 'Abstract and paper submission deadline: September 15, 2026.';
    const e = edition();
    e.deadlines[0].evidence = 'Abstract and paper submission deadline: September 15, 2026';
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines[0].kind).toBe('paper');
  });

  it('drops implausible deadline dates even when the page states them', () => {
    const page = 'Important dates. Paper deadline: January 1, 2031.';
    const e = edition({ start_date: null });
    e.deadlines[0].date = '2031-01-01';
    e.deadlines[0].evidence = 'Paper deadline: January 1, 2031';
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/implausible/);
  });

  it('drops editions outside the year window', () => {
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [edition({ year: 2031 })] }, { pageText, today: TODAY });
    expect(editions).toHaveLength(0);
    expect(flags[0]).toMatch(/year 2031/);
  });

  it('drops a deadline that falls after the conference start', () => {
    const e = edition({ start_date: '2026-09-01' });
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/after the conference start/);
  });

  it('drops deadlines with empty evidence', () => {
    const e = edition();
    e.deadlines[0].evidence = '';
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/evidence not found|missing evidence/);
  });

  it('drops deadlines with undefined evidence', () => {
    const e = edition();
    delete e.deadlines[0].evidence;
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/evidence not found|missing evidence/);
  });
});

describe('validateEditions date-evidence hardening', () => {
  it('rejects a date assembled from adjacent digit runs and a stray year', () => {
    // '151' must not vouch for day 15 month 1, however submission-flavored
    // the sentence is and wherever a full year happens to appear.
    const evidence = 'Submit papers, Hall 151, program 2026';
    const result = validateEditions(
      { editions: [{ year: 2026, start_date: null, deadlines: [
        { kind: 'paper', date: '2026-01-15', time: null, timezone_text: null, evidence }] }] },
      { pageText: evidence, today: TODAY },
    );
    expect(result.editions[0].deadlines).toHaveLength(0);
    expect(result.flags.some((f) => f.includes('does not state this date'))).toBe(true);
  });

  it('still accepts numeric day/month joined by a real separator', () => {
    const evidence = 'Submit papers by 15/09/2026';
    const result = validateEditions(
      { editions: [{ year: 2026, start_date: null, deadlines: [
        { kind: 'paper', date: '2026-09-15', time: null, timezone_text: null, evidence }] }] },
      { pageText: evidence, today: TODAY },
    );
    expect(result.editions[0].deadlines).toHaveLength(1);
  });

  it('drops an impossible start date the shape check alone would pass', () => {
    const result = validateEditions(
      { editions: [{ year: 2026, start_date: '2026-02-31', deadlines: [] }] },
      { pageText: '', today: TODAY },
    );
    expect(result.editions[0].start_date).toBeNull();
    expect(result.flags.some((f) => f.includes('2026-02-31'))).toBe(true);
  });
});

describe('editionToFacts', () => {
  it('maps abstract and paper deadlines into merge.js facts', () => {
    const e = edition();
    e.deadlines.push({ kind: 'abstract', date: '2026-08-01', time: '12:00', timezone_text: 'UTC',
      evidence: 'x' });
    e.location = 'Kigali, Rwanda';
    const facts = editionToFacts(e, 'UTC-12');
    expect(facts.location).toBe('Kigali, Rwanda');
    expect(facts.startIso).toBe('2026-11-10');
    expect(facts.deadline.toISO()).toBe('2026-09-16T11:59:00.000Z');
    expect(facts.abstractDeadline.toISO()).toBe('2026-08-01T12:00:00.000Z');
  });
});

describe('bigMoveFlags', () => {
  it('flags moves beyond the threshold and ignores small ones', () => {
    const flags = bigMoveFlags([
      { id: 'conf26', field: 'deadline', old: '2026-01-01 23:59', new: '2026-06-01 23:59' },
      { id: 'conf26', field: 'deadline', old: '2026-01-01 23:59', new: '2026-01-15 23:59' },
      { id: 'conf26', field: 'place', old: 'A', new: 'B' },
      { id: 'conf27', field: 'abstract_deadline', old: null, new: '2026-06-01 23:59' },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatch(/conf26.*large deadline move/);
  });

  it('flags a move away from a hand-authored deadline that carries seconds', () => {
    const flags = bigMoveFlags([
      { id: 'conf26', field: 'deadline', old: '2026-05-25 23:59:00', new: '2026-09-01 23:59' },
    ]);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatch(/large deadline move/);
  });
});
