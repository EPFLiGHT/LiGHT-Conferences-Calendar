import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import { validateEditions, conferenceDatesShown } from './gates.js';
import { editionToFacts } from './facts.js';
import { TODAY, edition, deadline } from './test-helpers.js';

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

  it('drops a date whose evidence names nothing of its type (a bursary reported as a paper)', () => {
    const page = 'Important dates. 30 April 26: Gertrud Meissner application deadline.';
    const e = edition();
    e.deadlines[0].date = '2026-04-30';
    e.deadlines[0].evidence = '30 April 26: Gertrud Meissner application deadline';
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/evidence names no full paper/);
  });

  it('keeps a submission deadline that shares its line with a grant deadline', () => {
    const page = 'Dates. 10 May 26: Abstract deadline and travel grant applications EXTENDED DATE.';
    const e = edition();
    e.deadlines[0] = {
      type: 'abstract', date: '2026-05-10', time: null, timezone_text: null,
      evidence: '10 May 26: Abstract deadline and travel grant applications EXTENDED DATE',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
    expect(flags).toEqual([]);
  });

  it('matches plural submission words', () => {
    const page = 'The call for abstracts will be open from July 1 to September 1, 2026.';
    const e = edition();
    e.deadlines[0] = {
      type: 'abstract', date: '2026-09-01', time: null, timezone_text: null,
      evidence: 'The call for abstracts will be open from July 1 to September 1, 2026.',
    };
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
  });

  it('drops a date the quote does not state (month only, or no date at all)', () => {
    const page = 'Abstract Submission Deadline April 2026. Full paper submission deadline: Closed.';
    const vague = edition();
    vague.deadlines[0] = {
      type: 'abstract', date: '2026-04-01', time: null, timezone_text: null,
      evidence: 'Abstract Submission Deadline April 2026',
    };
    const closed = edition();
    closed.deadlines[0] = {
      type: 'paper', date: '2026-04-15', time: null, timezone_text: null,
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
    const e = edition();
    e.deadlines[0] = {
      type: 'abstract', date: '2026-05-10', time: null, timezone_text: null,
      evidence: '10 May 26: Abstract deadline',
    };
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
  });

  it('keeps an abstract registration deadline (a submission, despite the word registration)', () => {
    const page = 'Paper Abstract Registration (Intention to Submit) Thursday, February 12, 2026';
    const e = edition();
    e.deadlines[0] = {
      type: 'abstract', date: '2026-02-12', time: null, timezone_text: null,
      evidence: 'Paper Abstract Registration (Intention to Submit) Thursday, February 12, 2026',
    };
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(1);
  });

  it('drops post-submission dates even when they say "paper"', () => {
    const page = 'October 1, 2026 Camera-ready accepted paper deadline. September 8, 2026 Notification of paper acceptance.';
    const e = edition({ year: 2026 });
    e.deadlines[0] = {
      type: 'paper', date: '2026-10-01', time: null, timezone_text: null,
      evidence: 'October 1, 2026 Camera-ready accepted paper deadline',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/names a later stage/);
  });

  it('corrects the type when the evidence contradicts the model', () => {
    const page = '10 May 26: Abstract deadline and travel grant applications.';
    const e = edition();
    e.deadlines[0] = {
      type: 'paper', date: '2026-05-10', time: null, timezone_text: null,
      evidence: '10 May 26: Abstract deadline and travel grant applications',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines[0].type).toBe('abstract');
    expect(flags[0]).toMatch(/reported as paper.*reads as abstract/);
  });

  it('reads "Paper registration" as the paper abstract beside a full paper', () => {
    const page = 'Paper registration: February 1, 2026. Full paper submission: March 1, 2026.';
    const e = edition();
    e.deadlines = [
      { type: 'abstract', date: '2026-02-01', time: null, timezone_text: null,
        evidence: 'Paper registration: February 1, 2026' },
      { type: 'paper', date: '2026-03-01', time: null, timezone_text: null,
        evidence: 'Full paper submission: March 1, 2026' },
    ];
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines.map((d) => d.type)).toEqual(['paper_abstract', 'paper']);
    const facts = editionToFacts(editions[0], 'UTC');
    expect(facts.deadlines.map((d) => [d.type, d.due.toISODate()])).toEqual([
      ['paper_abstract', '2026-02-01'], ['paper', '2026-03-01'],
    ]);
    expect(flags).toContain('2026 abstract deadline 2026-02-01: reported as abstract, but its evidence reads as paper_abstract; recorded as paper_abstract');
  });

  it('never blesses the model labels silently when the evidence disagrees with both, then reads the abstract beside the paper as a paper abstract', () => {
    const page = 'Full paper submission 10 January 2026. Paper submission 20 January 2026.';
    const e = edition();
    e.deadlines = [
      { type: 'abstract', date: '2026-01-10', time: null, timezone_text: null,
        evidence: 'Full paper submission 10 January 2026' },
      { type: 'paper', date: '2026-01-20', time: null, timezone_text: null,
        evidence: 'Paper submission 20 January 2026' },
    ];
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] },
      { pageText: page, today: DateTime.fromISO('2025-12-01T00:00:00Z', { zone: 'utc' }) });
    expect(editions[0].deadlines.map((d) => d.type)).toEqual(['paper_abstract', 'paper']);
    expect(flags).toContain('2026: the evidence reads as "paper" for the abstract and paper deadlines; kept the model\'s types, check which row is which');
  });

  it('drops a second deadline of the same type rather than letting it be lost silently', () => {
    const page = 'Paper deadline: September 15, 2026. Paper deadline: September 20, 2026.';
    const e = edition();
    e.deadlines = [
      { type: 'paper', date: '2026-09-15', time: null, timezone_text: null,
        evidence: 'Paper deadline: September 15, 2026' },
      { type: 'paper', date: '2026-09-20', time: null, timezone_text: null,
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
    e.deadlines[0] = { type: 'paper', date, time: null, timezone_text: null, evidence };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: evidence, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/does not state this date/);
  });

  it('requires a two-digit year to sit beside the date, not loose in the text', () => {
    const page = 'Paper deadline March 15 Room 26';
    const e = edition();
    e.deadlines[0] = {
      type: 'paper', date: '2026-03-15', time: null, timezone_text: null,
      evidence: 'Paper deadline March 15 Room 26',
    };
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags[0]).toMatch(/does not state this date/);
  });

  it('drops a day the quote never states, even when the number appears elsewhere', () => {
    const page = 'Papers due in November 2026 (see item 1).';
    const e = edition();
    e.deadlines[0] = {
      type: 'paper', date: '2026-11-01', time: null, timezone_text: null,
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

  it('keeps the model type when the evidence names both', () => {
    const page = 'Abstract and paper submission deadline: September 15, 2026.';
    const e = edition();
    e.deadlines[0].evidence = 'Abstract and paper submission deadline: September 15, 2026';
    const { editions } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines[0].type).toBe('paper');
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
    const e = edition({ start_date: '2026-09-01', dates_evidence: 'Conference: 1 September 2026' });
    const page = `${pageText} Conference: 1 September 2026.`;
    const { editions, flags } = validateEditions(
      { page_has_dates: true, editions: [e] }, { pageText: page, today: TODAY });
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

describe('validateEditions deadline types', () => {
  const typesKept = (deadlines, page = deadlines.map((d) => d.evidence).join('\n')) =>
    validateEditions({ editions: [edition({ deadlines })] }, { pageText: page, today: TODAY }).editions[0].deadlines.map((d) => d.type);

  it('keeps registration, presenter and grant deadlines whose quotes say so', () => {
    expect(typesKept([
      deadline({ type: 'early_registration', date: '2026-10-14', evidence: 'Early bird registration deadline: 14 October 2026' }),
      deadline({ type: 'presenter_registration', date: '2026-10-30', evidence: 'Registration deadline for poster presenters: 30 October 2026' }),
      deadline({ type: 'grant', date: '2026-08-01', evidence: 'Scholarship applications close 1 August 2026' }),
    ])).toEqual(['early_registration', 'presenter_registration', 'grant']);
  });

  it('drops a grant whose quote names no grant', () => {
    const { editions, flags } = validateEditions(
      { editions: [edition({ deadlines: [deadline({ type: 'grant', date: '2026-08-01', evidence: 'Important: 1 August 2026' })] })] },
      { pageText: 'Important: 1 August 2026', today: TODAY });
    expect(editions[0].deadlines).toEqual([]);
    expect(flags).toEqual(['2026 grant deadline 2026-08-01: evidence names no scholarship or travel grant; dropped ("Important: 1 August 2026")']);
  });

  it('reads "Abstract registration" as a paper abstract and a workshop proposal as a proposal', () => {
    expect(typesKept([deadline({ type: 'registration', date: '2026-09-01', evidence: 'Abstract registration: 1 September 2026' })])).toEqual(['paper_abstract']);
    expect(typesKept([deadline({ type: 'paper', date: '2026-09-10', evidence: 'Workshop proposals due 10 September 2026' })])).toEqual(['proposal']);
  });

  it('turns an abstract beside a full paper into a paper abstract', () => {
    expect(typesKept([
      deadline({ type: 'abstract', date: '2026-09-01', evidence: 'Abstract deadline: 1 September 2026' }),
      deadline({ type: 'paper', date: '2026-09-08', evidence: 'Full paper deadline: 8 September 2026' }),
    ])).toEqual(['paper_abstract', 'paper']);
  });

  it('keeps a poster deadline whose quote only says submission', () => {
    expect(typesKept([deadline({ type: 'poster', date: '2026-09-15', evidence: 'Submission deadline: 15 September 2026' })])).toEqual(['poster']);
  });

  it('reads "Late-breaker" and satellite sessions, as the Union World Conference writes them', () => {
    expect(typesKept([
      deadline({ type: 'late_breaking', date: '2026-07-22', evidence: '22-July-26 Late-breaker abstract submissions close' }),
      deadline({ type: 'proposal', date: '2026-08-03', evidence: '3-Aug-26 Satellite (Round 2) submissions close' }),
    ])).toEqual(['late_breaking', 'proposal']);
  });

  it('accepts a year-less quote when the page gives that day with its year, as AIME does', () => {
    const page = 'Type | Early Bird (until October 10) | Late/ On-Site | At least one author must register by October 10th, 2026. Submit grants by SEPTEMBER 30th.';
    const { editions, flags } = validateEditions({ editions: [edition({ deadlines: [
      deadline({ type: 'early_registration', date: '2026-10-10', evidence: 'Type | Early Bird (until October 10) | Late/ On-Site |' }),
      deadline({ type: 'grant', date: '2026-09-30', evidence: 'Submit grants by SEPTEMBER 30th.' }),
    ] })] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines.map((d) => d.type)).toEqual(['early_registration']);
    expect(flags).toEqual(['2026 grant deadline 2026-09-30: the page does not state this date; dropped ("Submit grants by SEPTEMBER 30th.")']);
  });

  it('drops a year-less quote when the page gives that day only with another year', () => {
    const page = 'Early Bird (until October 10). Authors must register by October 10th, 2025.';
    expect(typesKept([deadline({ type: 'early_registration', date: '2026-10-10', evidence: 'Early Bird (until October 10)' })], page)).toEqual([]);
  });

  it('never turns a grant into a proposal', () => {
    expect(typesKept([deadline({ type: 'grant', date: '2026-08-01', evidence: 'Travel grant proposals due 1 August 2026' })])).toEqual(['grant']);
  });

  it('keeps an abstract due after the paper as an abstract, not the paper\'s abstract', () => {
    expect(typesKept([
      deadline({ type: 'paper', date: '2026-08-03', evidence: 'Full paper deadline: 3 August 2026' }),
      deadline({ type: 'abstract', date: '2026-12-01', evidence: 'Abstract deadline: 1 December 2026' }),
    ])).toEqual(['paper', 'abstract']);
  });

  it('keeps registration closing during the event, but not a paper due then', () => {
    const page = 'Conference: November 10-12, 2026. Registration closes 12 November 2026. Paper deadline: 11 November 2026.';
    const e = edition({ start_date: '2026-11-10', end_date: '2026-11-12', dates_evidence: 'Conference: November 10-12, 2026', deadlines: [
      deadline({ type: 'registration', date: '2026-11-12', evidence: 'Registration closes 12 November 2026' }),
      deadline({ type: 'paper', date: '2026-11-11', evidence: 'Paper deadline: 11 November 2026' }),
    ] });
    const { editions, flags } = validateEditions({ editions: [e] }, { pageText: page, today: TODAY });
    expect(editions[0].deadlines.map((x) => x.type)).toEqual(['registration']);
    expect(flags).toEqual(['2026 paper deadline 2026-11-11: after the conference start 2026-11-10; dropped']);
  });

  it('keeps a late-breaking abstract and drops a registration whose quote names none', () => {
    expect(typesKept([
      deadline({ type: 'late_breaking', date: '2026-09-20', evidence: 'Late-breaking abstracts: 20 September 2026' }),
      deadline({ type: 'registration', date: '2026-09-25', evidence: 'Hotel booking closes 25 September 2026' }),
    ])).toEqual(['late_breaking']);
  });
});

describe('validateEditions date-evidence hardening', () => {
  it('rejects a date assembled from adjacent digit runs and a stray year', () => {
    // '151' must not vouch for day 15 month 1, however submission-flavored
    // the sentence is and wherever a full year happens to appear.
    const evidence = 'Submit papers, Hall 151, program 2026';
    const result = validateEditions(
      { editions: [{ year: 2026, start_date: null, deadlines: [
        { type: 'paper', date: '2026-01-15', time: null, timezone_text: null, evidence }] }] },
      { pageText: evidence, today: TODAY },
    );
    expect(result.editions[0].deadlines).toHaveLength(0);
    expect(result.flags.some((f) => f.includes('does not state this date'))).toBe(true);
  });

  it('still accepts numeric day/month joined by a real separator', () => {
    const evidence = 'Submit papers by 15/09/2026';
    const result = validateEditions(
      { editions: [{ year: 2026, start_date: null, deadlines: [
        { type: 'paper', date: '2026-09-15', time: null, timezone_text: null, evidence }] }] },
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

// EMBC 2027's dates page as htmlToText renders it: each cell is a date, then its label.
const EMBC_PAGE = [
  'Important Dates',
  'Proposals (Workshops/Mini Symposium) | 24 January 2027 Submission Deadline | 28 February 2027 Accept/Reject Notification | 31 March 2027 Information Submission |',
  'Full Contributed Papers | 24 January 2027 Submission Deadline | 16 April 2027 Accept/Reject Notification | 30 April 2027 Final Submission Deadline |',
  'All submission deadlines are final and will be strictly observed.',
].join('\n');

const embcEdition = (deadlines) => edition({
  year: 2027,
  deadlines: deadlines.map(([type, date, evidence]) => deadline({ type, date, evidence })),
});

describe('validateEditions table cells', () => {
  it('drops a date whose own cell labels it a later stage', () => {
    const { editions, flags } = validateEditions(
      { editions: [embcEdition([['paper', '2027-04-16', 'Full Contributed Papers | 24 January 2027 Submission Deadline | 16 April 2027']])] },
      { pageText: EMBC_PAGE, today: TODAY });
    expect(editions[0].deadlines).toHaveLength(0);
    expect(flags).toEqual(['2027 paper deadline 2027-04-16: the page labels this date "Accept/Reject Notification"; dropped']);
  });

  it('keeps the date that shares its cell with the submission label', () => {
    const { editions, flags } = validateEditions(
      { editions: [embcEdition([['paper', '2027-01-24', 'Full Contributed Papers | 24 January 2027 Submission Deadline']])] },
      { pageText: EMBC_PAGE, today: TODAY });
    expect(editions[0].deadlines.map((d) => d.date)).toEqual(['2027-01-24']);
    expect(flags).toEqual([]);
  });

  it('keeps a workshop proposal as a proposal now that proposals are tracked', () => {
    const { editions, flags } = validateEditions(
      { editions: [embcEdition([['abstract', '2027-01-24', 'Proposals (Workshops/Mini Symposium) | 24 January 2027 Submission Deadline']])] },
      { pageText: EMBC_PAGE, today: TODAY });
    expect(editions[0].deadlines.map((d) => d.type)).toEqual(['proposal']);
    expect(flags[0]).toMatch(/reported as abstract, but its evidence reads as proposal/);
  });
});

describe('validateEditions conference facts', () => {
  const page = 'AIME 2027. Conference Dates: July 5-8, 2027. Venue: KIT Royal Tropical Institute, Amsterdam, The Netherlands. International Conference on Artificial Intelligence in Medicine.';
  const aime = (over) => edition({
    year: 2027, start_date: '2027-07-05', end_date: '2027-07-08',
    dates_evidence: 'Conference Dates: July 5-8, 2027', deadlines: [], ...over,
  });

  it('keeps start and end that a quoted range states', () => {
    const { editions, flags } = validateEditions({ editions: [aime()] }, { pageText: page, today: TODAY });
    expect(editions[0].start_date).toBe('2027-07-05');
    expect(editions[0].end_date).toBe('2027-07-08');
    expect(flags).toEqual([]);
  });

  it('reads a day-first range and a cross-month range', () => {
    const text = 'from 21-25 March 2027; main event 27 September - 01 October 2027';
    const a = validateEditions({ editions: [aime({ start_date: '2027-03-21', end_date: '2027-03-25', dates_evidence: 'from 21-25 March 2027' })] },
      { pageText: text, today: TODAY });
    expect([a.editions[0].start_date, a.editions[0].end_date]).toEqual(['2027-03-21', '2027-03-25']);
    const b = validateEditions({ editions: [aime({ start_date: '2027-09-27', end_date: '2027-10-01', dates_evidence: '27 September - 01 October 2027' })] },
      { pageText: text, today: TODAY });
    expect([b.editions[0].start_date, b.editions[0].end_date]).toEqual(['2027-09-27', '2027-10-01']);
  });

  it('drops conference dates without a quote from the page', () => {
    const { editions, flags } = validateEditions({ editions: [aime({ dates_evidence: null })] }, { pageText: page, today: TODAY });
    expect(editions[0].start_date).toBeNull();
    expect(editions[0].end_date).toBeNull();
    expect(flags).toEqual(['edition 2027: conference dates 2027-07-05 to 2027-07-08 are not shown in a quote from the page; dropped']);
  });

  it('drops only the end when the quote does not state it', () => {
    const { editions, flags } = validateEditions({ editions: [aime({ end_date: '2027-07-09' })] }, { pageText: page, today: TODAY });
    expect(editions[0].start_date).toBe('2027-07-05');
    expect(editions[0].end_date).toBeNull();
    expect(flags).toEqual(['edition 2027: end date 2027-07-09 is not shown in the quote; dropped']);
  });

  it('keeps a location whose city is on the page and drops one that is not', () => {
    const ok = validateEditions({ editions: [aime({ location: 'Amsterdam, Netherlands' })] }, { pageText: page, today: TODAY });
    expect(ok.editions[0].location).toBe('Amsterdam, Netherlands');
    const bad = validateEditions({ editions: [aime({ location: 'Rotterdam, Netherlands' })] }, { pageText: page, today: TODAY });
    expect(bad.editions[0].location).toBeNull();
    expect(bad.flags).toEqual(['edition 2027: location "Rotterdam, Netherlands" is not on the page; dropped']);
  });

  it('matches a full name across the stray spaces some sites print inside words', () => {
    const text = `${page} The 47th AN NUAL CONGRESS of the European Society of Mycobacteriology`;
    const { editions, flags } = validateEditions(
      { editions: [aime({ full_name: 'Annual Congress of the European Society of Mycobacteriology' })] },
      { pageText: text, today: TODAY });
    expect(editions[0].full_name).toBe('Annual Congress of the European Society of Mycobacteriology');
    expect(flags).toEqual([]);
  });

  it('drops a full name the page does not carry', () => {
    const ok = validateEditions({ editions: [aime({ full_name: 'International Conference on Artificial Intelligence in Medicine' })] },
      { pageText: page, today: TODAY });
    expect(ok.editions[0].full_name).toBe('International Conference on Artificial Intelligence in Medicine');
    const bad = validateEditions({ editions: [aime({ full_name: 'Artificial Intelligence in Medicine Europe' })] },
      { pageText: page, today: TODAY });
    expect(bad.editions[0].full_name).toBeNull();
    expect(bad.flags).toEqual(['edition 2027: full name "Artificial Intelligence in Medicine Europe" is not on the page; dropped']);
  });
});

describe('conferenceDatesShown in Swiss languages', () => {
  it.each([
    ['du 27 au 28 octobre 2026', '2026-10-27', '2026-10-28'],
    ['14.-15. Oktober 2026', '2026-10-14', '2026-10-15'],
    ['1er décembre 2026', '2026-12-01', null],
    ['dal 3 al 5 marzo 2027', '2027-03-03', '2027-03-05'],
    ['les 27 et 28 octobre 2026', '2026-10-27', '2026-10-28'],
    ['25. & 26. November 2026', '2026-11-25', '2026-11-26'],
    ['27. und 28. Oktober 2026', '2026-10-27', '2026-10-28'],
    ['du mardi 27 au mercredi 28 octobre 2026', '2026-10-27', '2026-10-28'],
    ['Montag, 14. bis Dienstag, 15. Oktober 2026', '2026-10-14', '2026-10-15'],
    ['14 déc. 2026', '2026-12-14', null],
    ['3 juil. 2027', '2027-07-03', null],
    ['15 août 2026', '2026-08-15', null],
  ])('reads "%s"', (quote, start, end) => {
    expect(conferenceDatesShown(start, end, quote)).toEqual({ start: true, end: Boolean(end) });
  });

  it('still requires the month to be a whole word', () => {
    expect(conferenceDatesShown('2026-05-03', null, 'see email 3, 2026').start).toBe(false);
  });

  it('gives a day to the month named after it, not to a weekday that reads as one', () => {
    expect(conferenceDatesShown('2026-03-14', null, 'mar. 14 octobre 2026').start).toBe(false);
    expect(conferenceDatesShown('2026-03-14', '2026-03-16', 'mar. 14 au jeu. 16 octobre 2026').start).toBe(false);
    expect(conferenceDatesShown('2026-03-14', '2026-04-02', 'Mar 14 - Apr 2, 2026')).toEqual({ start: true, end: true });
  });
});
