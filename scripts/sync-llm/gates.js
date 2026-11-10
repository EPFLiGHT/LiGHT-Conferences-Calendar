/**
 * The gate between what the model says and what reaches the YAML. Prompts make
 * a model wrong less often; they never make it right always, so nothing here
 * takes its word for anything.
 *
 * A deadline survives only if its quote appears on the page it cites (which
 * catches both invented dates and instructions smuggled into page text), the
 * quote names what is due (words fitting its type), the quote shows the date rather than
 * merely implying it, the date's own table cell does not label it a later
 * stage, the date is plausibly near, and it falls before the conference
 * itself. Conference dates need a quote too, and the location and full name
 * must appear on the page. What survives becomes the facts object the shared
 * merge layer writes from, so sync_pin and curated fields still hold downstream.
 */
import { DateTime } from 'luxon';
import { isValidDate } from '../../src/utils/conferenceSchema.js';
import { ABSTRACT_FAMILY, DEADLINE_TYPES } from '../../src/constants/deadlineTypes.data.js';
import { resolveZone, parseDeadline } from './facts.js';

export const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
// Ignores the stray spaces some sites print inside words ("AN NUAL CONGRESS").
export const squash = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

// Later stages, whose rows still say "paper" or "submission". Not "registration":
// "Abstract Registration" is a real deadline.
const NOT_A_DEADLINE_RE = /camera.?ready|notification|acceptance/i;

// English, French, German and Italian names and abbreviations, all anchored on
// word boundaries below. A bare `sep[a-z]*` would let "separate", "maybe" and
// "marathon" stand in for a month and vouch for a date the page never states.
const MONTHS = [
  ['january', 'jan', 'janvier', 'janv', 'januar', 'gennaio'],
  ['february', 'feb', 'février', 'fevrier', 'févr', 'fevr', 'februar', 'febbraio'],
  ['march', 'mar', 'mars', 'märz', 'maerz', 'marzo'],
  ['april', 'apr', 'avril', 'avr', 'aprile'],
  ['may', 'mai', 'maggio'],
  ['june', 'jun', 'juin', 'juni', 'giugno'],
  ['july', 'jul', 'juillet', 'juil', 'juli', 'luglio'],
  ['august', 'aug', 'août', 'aout', 'agosto'],
  ['september', 'sept', 'sep', 'septembre', 'settembre'],
  ['october', 'oct', 'octobre', 'oktober', 'okt', 'ottobre'],
  ['november', 'nov', 'novembre'],
  ['december', 'dec', 'décembre', 'decembre', 'déc', 'dezember', 'dez', 'dicembre'],
];

// "mar. 14 octobre" is a French Tuesday, not March 14: a day (or day range)
// followed by another month's name belongs to that month.
const notOtherMonth = (month) =>
  `(?!(?:${RANGE_SEP}\\d{1,2}(?:st|nd|rd|th|er|\\.)?)?\\.?\\s*\\b(?:${MONTHS.filter((_, i) => i !== month - 1).flat().join('|')})\\b)`;

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
 * With pageText, a year-less quote ("Early Bird (until May 10)") also passes
 * when the page gives that day and month with the year beside it elsewhere.
 */
function dateShownInEvidence(dateIso, evidence, pageText = null) {
  const [year, month, day] = dateIso.split('-').map(Number);
  const names = MONTHS[month - 1];
  if (!names) return false;
  const pad = (n) => String(n).padStart(2, '0');
  const nameRe = `\\b(?:${names.join('|')})\\b`;
  const numRe = `(?:${month}|${pad(month)})`;
  const dayRe = `(?:${day}(?:st|nd|rd|th|er)?|${pad(day)})`;
  const sep = '[\\s,./-]{0,4}';
  const sepReq = '[\\s,./-]{1,4}';
  const shortYear = `${sepReq}(?:${year % 100})(?!\\d)`;
  const orders = (tail) => [
    new RegExp(`(?<!\\d)${dayRe}${sep}${nameRe}${tail}`, 'i'),
    new RegExp(`(?<!\\d)${nameRe}${sep}${dayRe}${notOtherMonth(month)}${tail}`, 'i'),
    new RegExp(`(?<!\\d)${dayRe}${sepReq}${numRe}${tail}`, 'i'),
    new RegExp(`(?<!\\d)${numRe}${sepReq}${dayRe}${tail}`, 'i'),
  ];
  const adjacent = orders('(?!\\d)').some((re) => re.test(evidence));
  if (!adjacent) return false;
  const fullYearShown = new RegExp(`(?<!\\d)${year}(?!\\d)`).test(evidence);
  if (fullYearShown || orders(shortYear).some((re) => re.test(evidence))) return true;
  const yearBeside = `${sepReq}(?:${year}|${year % 100})(?!\\d)`;
  return pageText != null && orders(yearBeside).some((re) => re.test(pageText));
}

// English, French, German and Italian weekdays, by their first three letters.
const WEEKDAY =
  '(?:(?:mon|tue|wed|thu|fri|sat|sun|lun|mar|mer|jeu|ven|sam|dim|die|mit|don|fre|son|gio|sab|dom)[a-zà-ÿ]*\\.?,?\\s*)?';
const RANGE_SEP = `\\s*(?:-|\\u2013|\\u2014|&|to|until|through|and|au|et|bis|und|al|e)\\s*${WEEKDAY}`;

/**
 * Whether a quote shows a conference's start and end, as two full dates or as
 * a day range under one month ("July 5-8, 2027", "21-25 March 2027").
 * @param {string} startIso
 * @param {string|null} endIso
 * @param {string} evidence
 * @returns {{start: boolean, end: boolean}}
 */
export function conferenceDatesShown(startIso, endIso, evidence) {
  const [year, month, startDay] = startIso.split('-').map(Number);
  const names = MONTHS[month - 1];
  const nameRe = `\\b(?:${names.join('|')})\\b\\.?`;
  // "1er" is French; German writes "14.-15. Oktober".
  const day = (d) => `0?${d}(?:st|nd|rd|th|er|\\.)?`;
  const inRange = (endDay) =>
    new RegExp(`(?<!\\d)${year}(?!\\d)`).test(evidence) &&
    [
      new RegExp(`${nameRe}\\s*${day(startDay)}${RANGE_SEP}${day(endDay)}(?!\\d)${notOtherMonth(month)}`, 'i'),
      new RegExp(`(?<!\\d)${day(startDay)}${RANGE_SEP}${day(endDay)}\\s*${nameRe}`, 'i'),
    ].some((re) => re.test(evidence));
  const sameMonthEnd = endIso && Number(endIso.slice(5, 7)) === month ? Number(endIso.slice(8)) : null;
  return {
    start: dateShownInEvidence(startIso, evidence) || inRange('\\d{1,2}'),
    end: Boolean(endIso) && (dateShownInEvidence(endIso, evidence) || (sameMonthEnd != null && inRange(sameMonthEnd))),
  };
}

export const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

// What remains must name what is due. Requiring the word beats blacklisting the
// rest: it keeps rows that pair a deadline with something else, like "Abstract
// deadline and travel grant applications".
const ABSTRACT_RE = /\babstracts?\b/i;
const PAPER_RE = /\b(papers?|manuscripts?)\b/i;
const POSTER_RE = /\bposters?\b/i;
const PROPOSAL_RE = /\bproposals?\b/i;
const SUBMISSION_RE = /\b(abstracts?|papers?|manuscripts?|posters?|submissions?|submit|submitting)\b/i;
const REGISTRATION_RE = /\bregist|\binscri|\banmeld|\btickets?\b|\bfees?\b/i;

/** Every pattern must match for a quote to back its type. */
const TYPE_WORDS = {
  paper_abstract: [SUBMISSION_RE],
  paper: [SUBMISSION_RE],
  abstract: [SUBMISSION_RE],
  poster: [SUBMISSION_RE],
  late_breaking: [/late[\s-]?break(?:ing|ers?)/i],
  proposal: [/\b(proposals?|workshops?|panels?|symposi(?:um|a)|tutorials?|sessions?|satellites?)\b/i],
  early_registration: [/early[\s-]?bird|\bearly registration|\breduced (?:fee|rate|price)|tarif réduit|inscription anticipée|frühbucher/i],
  registration: [REGISTRATION_RE],
  presenter_registration: [REGISTRATION_RE, /\b(presenters?|presenting|authors?|speakers?|accepted)\b/i],
  grant: [/scholarships?|bursar(?:y|ies)|\bgrants?\b|fellowships?|stipends?|travel (?:award|support|fund)|fee waivers?|\bbourses?\b/i],
};

const fitsType = (evidence, type) => Boolean(TYPE_WORDS[type]) && TYPE_WORDS[type].every((re) => re.test(evidence));

/**
 * Trust the page over the model's own label where the quote is unambiguous: the
 * quote is verbatim page text, while `type` is a judgment the model gets wrong on
 * pages listing one kind of submission. Anything else keeps the model's choice.
 */
function typeFromEvidence(evidence, modelType) {
  if (/\b(abstract|paper) registration\b/i.test(evidence)) return 'paper_abstract';
  const abstract = ABSTRACT_RE.test(evidence);
  const paper = PAPER_RE.test(evidence);
  if (ABSTRACT_FAMILY.includes(modelType) && paper && !abstract && !POSTER_RE.test(evidence)) return 'paper';
  if (modelType === 'paper' && abstract && !paper) return 'abstract';
  const submission = DEADLINE_TYPES[modelType]?.group === 'submission';
  if (submission && modelType !== 'proposal' && PROPOSAL_RE.test(evidence) && !abstract && !paper) return 'proposal';
  return modelType;
}

/**
 * Settle each deadline's type, keeping at most one of each.
 *
 * The evidence override reads a few words, and a dates page is full of rows that
 * borrow another type's vocabulary. Where applying it would merge rows the model
 * had told apart, those rows keep the model's types instead; otherwise the first
 * would win and the second be dropped as a duplicate, silently. Types whose quote
 * lacks their words are dropped, and an abstract due no later than a full paper
 * is the paper's abstract.
 * @param {Array<object>} deadlines Deadlines that passed every other gate.
 * @param {number} year Edition year, for flag text.
 * @param {string[]} flags Appended to in place.
 * @returns {Array<object>} At most one deadline per type.
 */
function reconcileTypes(deadlines, year, flags) {
  const modelTypes = deadlines.map((d) => d.type);
  const proposed = deadlines.map((d) => typeFromEvidence(d.evidence, d.type));
  const keepModel = proposed.map((t, i) => proposed.some((u, j) => j !== i && u === t && modelTypes[j] !== modelTypes[i]));

  // Trusting labels the evidence disagrees with is the safer guess, not a verified one.
  for (const t of new Set(proposed.filter((_, i) => keepModel[i]))) {
    const labelled = [...new Set(modelTypes.filter((_, i) => keepModel[i] && proposed[i] === t))];
    flags.push(
      `${year}: the evidence reads as "${t}" for the ${labelled.join(' and ')} deadlines; kept the model's types, check which row is which`,
    );
  }

  const kept = new Map();
  deadlines.forEach((d, i) => {
    const type = keepModel[i] ? d.type : proposed[i];
    const label = `${year} ${d.type} deadline ${d.date}`;
    if (type !== d.type) {
      flags.push(`${label}: reported as ${d.type}, but its evidence reads as ${type}; recorded as ${type}`);
    }
    if (!fitsType(d.evidence, type)) {
      const what = DEADLINE_TYPES[type]?.label?.toLowerCase() ?? type;
      flags.push(`${year} ${type} deadline ${d.date}: evidence names no ${what}; dropped ("${d.evidence.slice(0, 80)}")`);
      return;
    }
    if (kept.has(type)) {
      flags.push(`${label}: a ${type} deadline is already recorded for ${year}; dropped, check the page by hand`);
      return;
    }
    kept.set(type, { ...d, type });
  });
  const paperAbstract = kept.has('paper') && !kept.has('paper_abstract')
    && kept.get('abstract')?.date <= kept.get('paper').date;
  return [...kept.values()].map((d) => (paperAbstract && d.type === 'abstract' ? { ...d, type: 'paper_abstract' } : d));
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
    const end = endDate ? DateTime.fromISO(endDate, { zone: 'utc' }) : null;
    const survivors = [];
    for (const d of edition.deadlines) {
      const label = `${edition.year} ${d.type} deadline ${d.date}`;
      const needle = normalize(d.evidence ?? '');
      if (!needle || !haystack.includes(needle)) {
        flags.push(`${label}: evidence not found on the page; dropped`);
        continue;
      }
      if (NOT_A_DEADLINE_RE.test(d.evidence)) {
        flags.push(`${label}: evidence names a later stage, not a deadline; dropped ("${d.evidence.slice(0, 80)}")`);
        continue;
      }
      if (!dateShownInEvidence(d.date, d.evidence, pageText)) {
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
      // Registration may stay open until the last day; nothing else may be due after the start.
      if (DEADLINE_TYPES[d.type]?.group === 'registration' && end?.isValid) {
        if (dt > end.endOf('day')) {
          flags.push(`${label}: after the conference end ${endDate}; dropped`);
          continue;
        }
      } else if (start?.isValid && dt > start.endOf('day')) {
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
      deadlines: reconcileTypes(survivors, edition.year, flags),
    });
  }
  return { editions: out, flags };
}
