/**
 * The gate between what the model says and what reaches the YAML. Prompts make
 * a model wrong less often; they never make it right always, so nothing here
 * takes its word for anything.
 *
 * A deadline survives only if its quote appears on the page it cites (which
 * catches both invented dates and instructions smuggled into page text), the
 * quote names something being submitted, the quote shows the date rather than
 * merely implying it, the date is plausibly near, and it falls before the
 * conference itself. What survives becomes the facts object the shared merge
 * layer writes from, so sync_pin and curated fields still hold downstream.
 */
import { DateTime } from 'luxon';
import { isValidDate } from '../../src/utils/conferenceSchema.js';

const AOE_RE = /aoe|anywhere\s+on\s+earth/i;

// Only the abbreviations Luxon gets wrong. It rejects the daylight ones
// outright, and resolves "BST" to UTC+6 (Bangladesh) when a page writing it
// means British Summer Time. Everything else it already handles, including the
// standard-time names that a summer date must resolve through DST ("CET" in
// July is CEST), so listing those here would pin them an hour off.
const FIXED_OFFSETS = {
  edt: 'UTC-4', cdt: 'UTC-5', mdt: 'UTC-6', pdt: 'UTC-7',
  cest: 'UTC+2', bst: 'UTC+1', aest: 'UTC+10', aedt: 'UTC+11',
};

// The US names pages actually write, mapped to locations rather than offsets
// so the date itself decides DST ("ET" in July is UTC-4, in December UTC-5).
// Matched whole, with an optional trailing "time": "Central European Time"
// must fall through to Luxon, not read as US Central.
const NAMED_ZONES = {
  pt: 'America/Los_Angeles', pacific: 'America/Los_Angeles',
  et: 'America/New_York', eastern: 'America/New_York',
  ct: 'America/Chicago', central: 'America/Chicago',
  mt: 'America/Denver', mountain: 'America/Denver',
};

/**
 * Resolve a timezone as written on a page. Returns null rather than guessing,
 * so the caller can flag the deadline instead of silently storing it hours off.
 * @param {string|null} timezoneText Timezone exactly as written on the page.
 * @returns {string|null} A zone Luxon accepts, or null when unrecognized.
 */
export function resolveZone(timezoneText) {
  if (!timezoneText) return null;
  const candidate = timezoneText.trim();
  if (AOE_RE.test(candidate)) return 'UTC-12';
  const key = candidate.toLowerCase();
  const mapped = FIXED_OFFSETS[key] ?? NAMED_ZONES[key.replace(/\s+time$/, '')];
  if (mapped) return mapped;
  return DateTime.now().setZone(candidate).isValid ? candidate : null;
}

/**
 * @param {{date: string, time: string|null, timezone_text: string|null}} d
 * @param {string} entryTimezone Fallback when the page names no usable zone.
 * @returns {DateTime|null} UTC instant, or null when unparseable.
 */
export function parseDeadline({ date, time, timezone_text }, entryTimezone) {
  const zone = resolveZone(timezone_text) ?? entryTimezone;
  const dt = DateTime.fromISO(`${date}T${time ?? '23:59'}`, { zone });
  return dt.isValid ? dt.toUTC() : null;
}

const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Stages that follow submission. They carry the word "paper", so the
// submission check below cannot catch them. Attendee registration and early
// bird rows need no entry here: they name no submission and fail that check,
// while "Abstract Registration" is a submission deadline and must survive.
const NOT_A_DEADLINE_RE = /camera.?ready|notification|acceptance/i;

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
    out.push({ ...edition, start_date: startDate, deadlines: reconcileKinds(survivors, edition.year, flags) });
  }
  return { editions: out, flags };
}

/**
 * Convert a validated edition into the facts shape the merge layer consumes.
 * end_date is deliberately dropped: the merge layer infers the end from the
 * start, and a venue page stating one without the other is common.
 * @param {object} edition Validated edition.
 * @param {string} entryTimezone The matched entry's timezone field.
 * @returns {{fullName: string|null, location: string|null, startIso: string|null,
 *   abstractDeadline: DateTime|null, deadline: DateTime|null}}
 */
export function editionToFacts(edition, entryTimezone) {
  const byKind = (kind) => edition.deadlines.find((d) => d.kind === kind);
  const abstract = byKind('abstract');
  const paper = byKind('paper');
  return {
    fullName: edition.full_name || null,
    location: edition.location || null,
    startIso: edition.start_date || null,
    abstractDeadline: abstract ? parseDeadline(abstract, entryTimezone) : null,
    deadline: paper ? parseDeadline(paper, entryTimezone) : null,
  };
}

// The sync writes "yyyy-MM-dd HH:mm", but a hand-authored value may carry
// seconds (conferenceSchema.js allows them), so parse both shapes.
const parseEntryDateTime = (s) => DateTime.fromISO(s.replace(' ', 'T'), { zone: 'utc' });

/**
 * Flag applied deadline changes that moved by more than thresholdDays.
 * @param {Array<{id: string, field: string, old: string|null, new: string}>} changes
 *   The change list updateEntry returns; values are "yyyy-MM-dd HH:mm[:ss]".
 * @param {number} [thresholdDays]
 * @returns {string[]}
 */
export function bigMoveFlags(changes, thresholdDays = 60) {
  const flags = [];
  for (const c of changes) {
    if (c.field !== 'deadline' && c.field !== 'abstract_deadline') continue;
    if (!c.old) continue;
    const oldDt = parseEntryDateTime(c.old);
    const newDt = parseEntryDateTime(c.new);
    if (!oldDt.isValid || !newDt.isValid) continue;
    const days = Math.abs(newDt.diff(oldDt, 'days').days);
    if (days > thresholdDays) {
      flags.push(`${c.id}: large deadline move on ${c.field} (${Math.round(days)} days); verify against the venue site`);
    }
  }
  return flags;
}
