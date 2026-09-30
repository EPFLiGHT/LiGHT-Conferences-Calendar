/**
 * The gate between what the model says and what reaches the YAML. Prompts make
 * a model wrong less often; they never make it right always, so nothing here
 * takes its word for anything.
 *
 * A deadline survives only if its quote appears on the page it cites (which
 * catches both invented dates and instructions smuggled into page text), the
 * quote names something being submitted, the quote shows the date rather than
 * merely implying it, the date's own table cell does not label it a later
 * stage, the date is plausibly near, and it falls before the conference
 * itself. Conference dates need a quote too, and the location and full name
 * must appear on the page. What survives becomes the facts object the shared
 * merge layer writes from, so sync_pin and curated fields still hold downstream.
 */
import { DateTime } from 'luxon';
import { isValidDate } from '../../src/utils/conferenceSchema.js';
import { resolveZone, parseDeadline } from './facts.js';

const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
// Ignores the stray spaces some sites print inside words ("AN NUAL CONGRESS").
const squash = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Later stages and workshop or tutorial proposals, whose rows still say "paper" or
// "submission". Not "registration": "Abstract Registration" is a real deadline.
const NOT_A_DEADLINE_RE = /camera.?ready|notification|acceptance|\bproposals?\b/i;

// Full names and their abbreviations, both anchored on word boundaries below.
// A bare `sep[a-z]*` would let "separate", "maybe" and "marathon" stand in for
// a month and vouch for a date the page never states.
const MONTHS = [
  ['january', 'jan'], ['february', 'feb'], ['march', 'mar'], ['april', 'apr'],
  ['may'], ['june', 'jun'], ['july', 'jul'], ['august', 'aug'],
  ['september', 'sept', 'sep'], ['october', 'oct'], ['november', 'nov'], ['december', 'dec'],
];

/**
 * A page that says "April 2026" or "Closed." states no day, so a full date
 * built from it was invented. Require the day to sit next to the month, in
 * either order ("15 September", "September 15", "15/09", "09-15"), and the
 * year to be stated: either in full anywhere in the quote, or two-digit
 * directly after the day/month pair ("10 May 26"). A two-digit year loose in
 * the text is coincidence, not evidence: "March 15 Room 26" states no year,
 * and a stray "(see item 1)" must not vouch for a day-01 date. A numeric month
 * needs a real separator character next to the day: with none, "Hall 151"
 * would read as day 15 month 1 and a stray year elsewhere would vouch for it.
 */
function dateShownInEvidence(dateIso, evidence) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const names = MONTHS[month - 1];
  if (!names) return false;
  const pad = (n) => String(n).padStart(2, '0');
  const nameRe = `\\b(?:${names.join('|')})\\b`;
  const numRe = `(?:${month}|${pad(month)})`;
  const dayRe = `(?:${day}(?:st|nd|rd|th)?|${pad(day)})`;
  const sep = '[\\s,./-]{0,4}';
  const sepReq = '[\\s,./-]{1,4}';
  const shortYear = `${sepReq}(?:${year % 100})(?!\\d)`;
  const orders = (tail) => [
    new RegExp(`(?<!\\d)${dayRe}${sep}${nameRe}${tail}`, 'i'),
    new RegExp(`(?<!\\d)${nameRe}${sep}${dayRe}${tail}`, 'i'),
    new RegExp(`(?<!\\d)${dayRe}${sepReq}${numRe}${tail}`, 'i'),
    new RegExp(`(?<!\\d)${numRe}${sepReq}${dayRe}${tail}`, 'i'),
  ];
  const adjacent = orders('(?!\\d)').some((re) => re.test(evidence));
  if (!adjacent) return false;
  const fullYearShown = new RegExp(`(?<!\\d)${year}(?!\\d)`).test(evidence);
  return fullYearShown || orders(shortYear).some((re) => re.test(evidence));
}

const WEEKDAY = '(?:(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\\.?,?\\s*)?';
const RANGE_SEP = `\\s*(?:-|\\u2013|\\u2014|to|until|through)\\s*${WEEKDAY}`;

/**
 * Whether a quote shows a conference's start and end, as two full dates or as
 * a day range under one month ("July 5-8, 2027", "21-25 March 2027").
 * @param {string} startIso
 * @param {string|null} endIso
 * @param {string} evidence
 * @returns {{start: boolean, end: boolean}}
 */
function conferenceDatesShown(startIso, endIso, evidence) {
  const [year, month, startDay] = startIso.split('-').map(Number);
  const names = MONTHS[month - 1];
  const nameRe = `\\b(?:${names.join('|')})\\b\\.?`;
  const day = (d) => `0?${d}(?:st|nd|rd|th)?`;
  const inRange = (endDay) =>
    new RegExp(`(?<!\\d)${year}(?!\\d)`).test(evidence) &&
    [
      new RegExp(`${nameRe}\\s*${day(startDay)}${RANGE_SEP}${day(endDay)}(?!\\d)`, 'i'),
      new RegExp(`(?<!\\d)${day(startDay)}${RANGE_SEP}${day(endDay)}\\s*${nameRe}`, 'i'),
    ].some((re) => re.test(evidence));
  const sameMonthEnd = endIso && Number(endIso.slice(5, 7)) === month ? Number(endIso.slice(8)) : null;
  return {
    start: dateShownInEvidence(startIso, evidence) || inRange('\\d{1,2}'),
    end: Boolean(endIso) && (dateShownInEvidence(endIso, evidence) || (sameMonthEnd != null && inRange(sameMonthEnd))),
  };
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The rest of the table cell a quote ends in. Where a page puts the date before
 * its label ("16 April 2027 Accept/Reject Notification |"), that is the date's label.
 * @returns {string|null} null when the quote is not inside a table cell.
 */
function ownCellLabel(pageText, evidence) {
  const tokens = evidence.trim().split(/\s+/).map(escapeRe);
  const m = new RegExp(tokens.join('\\s+'), 'i').exec(pageText);
  if (!m) return null;
  const rest = pageText.slice(m.index + m[0].length);
  const end = rest.search(/[|\n]/);
  return end !== -1 && rest[end] === '|' ? rest.slice(0, end).trim() : null;
}

// What remains must name the thing being submitted. Requiring the word beats
// blacklisting the rest: it keeps rows that pair a deadline with something
// else, like "Abstract deadline and travel grant applications".
const ABSTRACT_RE = /\babstracts?\b/i;
const PAPER_RE = /\b(papers?|manuscripts?)\b/i;
const SUBMISSION_RE = /\b(abstracts?|papers?|manuscripts?|submissions?|submit|submitting)\b/i;

/**
 * Trust the page over the model's own label: the quote is verbatim page text,
 * while `kind` is a judgment the model gets wrong on pages listing one kind.
 * Ambiguous quotes (both words, or neither) keep the model's choice.
 */
function kindFromEvidence(evidence, modelKind) {
  const isAbstract = ABSTRACT_RE.test(evidence);
  const isPaper = PAPER_RE.test(evidence);
  if (isAbstract && !isPaper) return 'abstract';
  if (isPaper && !isAbstract) return 'paper';
  return modelKind;
}

const isDistinct = (kinds) => new Set(kinds).size === kinds.length;

/**
 * Settle each deadline's kind, keeping at most one of each.
 *
 * The evidence override reads a single word, and a submission page is full of
 * rows that borrow the other kind's vocabulary ("Paper registration" is the
 * abstract deadline). When applying it would collapse rows the model had
 * already told apart, the model's labels win instead. Without that, the two
 * rows both become "paper", and editionToFacts keeps the first of each kind,
 * so the stored `deadline` would silently be the abstract's earlier date.
 * @param {Array<object>} deadlines Deadlines that passed every other gate.
 * @param {number} year Edition year, for flag text.
 * @param {string[]} flags Appended to in place.
 * @returns {Array<object>} At most one deadline per kind.
 */
function reconcileKinds(deadlines, year, flags) {
  const proposed = deadlines.map((d) => kindFromEvidence(d.evidence, d.kind));
  const useEvidence = isDistinct(proposed) || !isDistinct(deadlines.map((d) => d.kind));

  // Suppressing the override means trusting labels the evidence disagrees with;
  // that is the safer guess, not a verified one, so it cannot pass unremarked.
  if (!useEvidence) {
    flags.push(
      `${year}: the evidence for every deadline reads as "${proposed[0]}", but the model labelled them ${deadlines.map((d) => d.kind).join(' and ')}; kept its labels, check which row is which`,
    );
  }

  const kept = new Map();
  deadlines.forEach((d, i) => {
    const kind = useEvidence ? proposed[i] : d.kind;
    const label = `${year} ${d.kind} deadline ${d.date}`;
    if (kind !== d.kind) {
      flags.push(`${label}: reported as ${d.kind}, but its evidence reads as ${kind}; recorded as ${kind}`);
    }
    if (kept.has(kind)) {
      flags.push(`${label}: a ${kind} deadline is already recorded for ${year}; dropped, check the page by hand`);
      return;
    }
    kept.set(kind, { ...d, kind });
  });
  return [...kept.values()];
}

/**
 * Run every gate over a raw extraction result. Nothing is repaired, only kept
 * or dropped with a flag saying why, so a silent failure cannot look like a
 * clean run.
 * @param {{editions: Array<object>}} result Parsed EDITIONS_SCHEMA output.
 * @param {{pageText: string, today?: DateTime}} ctx Text of the page the
 *   result cites, and an injectable "now" for tests.
 * @returns {{editions: Array<object>, flags: string[]}} Editions with only
 *   surviving deadlines; one flag per dropped item.
 */
export function validateEditions({ editions = [] }, { pageText, today = DateTime.utc() }) {
  const flags = [];
  const haystack = normalize(pageText);
  const minDate = today.minus({ months: 6 });
  const maxDate = today.plus({ months: 30 });
  const out = [];

  for (const edition of editions) {
    if (edition.year < today.year || edition.year > today.year + 2) {
      flags.push(`edition year ${edition.year} outside [${today.year}, ${today.year + 2}]; dropped`);
      continue;
    }
    // Same check scripts/validate.js runs later, so a "2026-02-31" or a
    // "2026-11-01T00:00" is flagged here instead of failing the PR's CI.
    let startDate = edition.start_date || null;
    if (startDate && !isValidDate(startDate)) {
      flags.push(`edition ${edition.year}: start date "${startDate}" is not a real YYYY-MM-DD date; dropped`);
      startDate = null;
    }
    let endDate = edition.end_date || null;
    if (endDate && !isValidDate(endDate)) {
      flags.push(`edition ${edition.year}: end date "${endDate}" is not a real YYYY-MM-DD date; dropped`);
      endDate = null;
    }
    if (startDate) {
      const quote = edition.dates_evidence ?? '';
      const onPage = Boolean(quote) && haystack.includes(normalize(quote));
      const shown = onPage ? conferenceDatesShown(startDate, endDate, quote) : { start: false, end: false };
      if (!shown.start) {
        flags.push(
          `edition ${edition.year}: conference dates ${startDate}${endDate ? ` to ${endDate}` : ''} are not shown in a quote from the page; dropped`,
        );
        startDate = null;
        endDate = null;
      } else if (endDate && !shown.end) {
        flags.push(`edition ${edition.year}: end date ${endDate} is not shown in the quote; dropped`);
        endDate = null;
      }
    } else {
      endDate = null;
    }
    let location = edition.location || null;
    if (location && !haystack.includes(normalize(location.split(',')[0]))) {
      flags.push(`edition ${edition.year}: location "${location}" is not on the page; dropped`);
      location = null;
    }
    let fullName = edition.full_name || null;
    if (fullName && !squash(pageText).includes(squash(fullName))) {
      flags.push(`edition ${edition.year}: full name "${fullName}" is not on the page; dropped`);
      fullName = null;
    }
    const start = startDate ? DateTime.fromISO(startDate, { zone: 'utc' }) : null;
    const survivors = [];
    for (const d of edition.deadlines) {
      const label = `${edition.year} ${d.kind} deadline ${d.date}`;
      const needle = normalize(d.evidence ?? '');
      if (!needle || !haystack.includes(needle)) {
        flags.push(`${label}: evidence not found on the page; dropped`);
        continue;
      }
      if (NOT_A_DEADLINE_RE.test(d.evidence) || !SUBMISSION_RE.test(d.evidence)) {
        flags.push(`${label}: evidence names no submission; dropped ("${d.evidence.slice(0, 80)}")`);
        continue;
      }
      if (!dateShownInEvidence(d.date, d.evidence)) {
        flags.push(`${label}: the page does not state this date; dropped ("${d.evidence.slice(0, 80)}")`);
        continue;
      }
      const cellLabel = ownCellLabel(pageText, d.evidence);
      if (cellLabel && NOT_A_DEADLINE_RE.test(cellLabel)) {
        flags.push(`${label}: the page labels this date "${cellLabel}"; dropped`);
        continue;
      }
      const dt = parseDeadline(d, 'utc');
      if (!dt || dt < minDate || dt > maxDate) {
        flags.push(`${label}: implausible or unparseable date; dropped`);
        continue;
      }
      if (start?.isValid && dt > start.endOf('day')) {
        flags.push(`${label}: after the conference start ${startDate}; dropped`);
        continue;
      }
      if (d.timezone_text && !resolveZone(d.timezone_text)) {
        flags.push(`${label}: timezone "${d.timezone_text}" is not recognized; read in the entry's own zone, verify the time`);
      }
      survivors.push(d);
    }
    out.push({
      ...edition,
      full_name: fullName,
      location,
      start_date: startDate,
      end_date: endDate,
      deadlines: reconcileKinds(survivors, edition.year, flags),
    });
  }
  return { editions: out, flags };
}
