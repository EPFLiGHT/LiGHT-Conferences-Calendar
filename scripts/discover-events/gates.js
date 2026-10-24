/**
 * The checks between an extraction and a draft, in the spirit of
 * scripts/sync-llm/gates.js: nothing is repaired, only kept or dropped with a
 * reason. An event survives when it is not a kind the criteria skip, its dates
 * quote is on the page and shows the dates, its name and city appear on the
 * page, the city is in Switzerland, the event starts inside the window, and a
 * one-day event whose quote gives its hours runs for at least four of them.
 * A link the page does not carry is replaced by the page itself, so a draft
 * never points at an invented URL.
 */
import { DateTime } from 'luxon';
import { isValidDate } from '../../src/utils/conferenceSchema.js';
import { conferenceDatesShown, normalize, squash, escapeRe } from '../sync-llm/gates.js';
import { normalizeUrl, isAllowedUrl } from '../sync-llm/urls.js';
import { HORIZON_MONTHS, EXCLUDED_KINDS } from './criteria.js';

// English name first; the rest are how pages in the national languages write it.
const SWISS_CITIES = [
  ['Geneva', 'Genève', 'Geneve', 'Genf', 'Ginevra'],
  ['Zurich', 'Zürich'],
  ['Lausanne'],
  ['Bern', 'Berne'],
  ['Basel', 'Bâle', 'Basle'],
  ['Lucerne', 'Luzern'],
  ['St. Gallen', 'St Gallen', 'Saint-Gall', 'St.Gallen'],
  ['Lugano'], ['Davos'], ['Montreux'], ['Interlaken'], ['Zermatt'], ['Zug'], ['Winterthur'],
  ['Neuchâtel', 'Neuchatel'],
  ['Fribourg'],
  ['Sion', 'Sitten'],
  ['Biel', 'Bienne'],
  ['Locarno'], ['Ascona'], ['Gstaad'], ['Crans-Montana'], ['Verbier'], ['St. Moritz', 'St Moritz'],
  ['Bürgenstock', 'Burgenstock'], ['Nyon'], ['Vevey'], ['Martigny'], ['Chur'], ['Thun'], ['Ecublens'],
];
const COUNTRY = '(?:switzerland|suisse|schweiz|svizzera)';
const TRAILING_COUNTRY_RE = new RegExp(`[\\s,]+${COUNTRY}$`, 'i');

// "14:00 - 15:30", "12h30-14h00", "3:30 pm - 4:30 pm". Dots are left out: "16.11" is a date.
const TIME_RANGE_RE = /(\d{1,2})[:h](\d{2})\s*(am|pm)?\s*(?:-|\u2013|\u2014|to|bis|\u00e0)\s*(\d{1,2})[:h](\d{2})\s*(am|pm)?/gi;
const MIN_SESSION_HOURS = 4;
// Shorter names must appear as whole words: squashed, "WEF" would match "we fund".
const MIN_SQUASHED_NAME = 6;

/**
 * How long a quote says a day's programme runs, from its first time range's
 * start to its last one's end ("Registration 08:30 - 09:00, programme 09:00 - 17:00").
 * @param {string} quote
 * @returns {number|null} Hours, or null when the quote states no range.
 */
function hoursShown(quote) {
  const toMinutes = (h, min, half) => {
    let hour = Number(h);
    if (half) hour = (hour % 12) + (half.toLowerCase() === 'pm' ? 12 : 0);
    return hour * 60 + Number(min);
  };
  let first = Infinity;
  let last = -Infinity;
  for (const m of quote.matchAll(TIME_RANGE_RE)) {
    // One am/pm can cover both times: "3:30 - 4:30 pm".
    first = Math.min(first, toMinutes(m[1], m[2], m[3] ?? m[6]));
    last = Math.max(last, toMinutes(m[4], m[5], m[6] ?? m[3]));
  }
  return last > first ? (last - first) / 60 : null;
}

// Whole words only: "Sion" must not match "session", nor "Chur" "church".
const mentions = (text, name) =>
  new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(normalize(name))}(?![\\p{L}\\p{N}])`, 'iu').test(text);

/**
 * The city's English name when the page names it, else null.
 * @param {string} city As the model reported it.
 * @param {string} haystack normalize()d page text.
 * @returns {string|null}
 */
function cityOnPage(city, haystack) {
  const name = city.replace(TRAILING_COUNTRY_RE, '').trim();
  if (!name) return null;
  const aliases = SWISS_CITIES.find((names) => names.some((a) => normalize(a) === normalize(name)));
  if (aliases) return aliases.some((a) => mentions(haystack, a)) ? aliases[0] : null;
  // A town off the list counts only where the page places it in Switzerland: "Engelberg, Switzerland",
  // or a Swiss postcode ("1008 Prilly") on a page that mentions Switzerland.
  const town = escapeRe(normalize(name));
  const placed = new RegExp(`(?<![\\p{L}\\p{N}])${town}[\\s,(]{1,3}${COUNTRY}`, 'iu');
  const postcode = new RegExp(`(?<![\\p{L}\\p{N}])(?:ch-)?\\d{4}\\s+${town}(?![\\p{L}\\p{N}])`, 'iu');
  return placed.test(haystack) || (postcode.test(haystack) && new RegExp(COUNTRY, 'i').test(haystack)) ? name : null;
}

/**
 * @param {Array<object>} events Raw EVENTS_SCHEMA items.
 * @param {{pageText: string, pageUrl: string, links?: Array<{href: string}>, today: DateTime}} ctx
 * @returns {{events: Array<object>, dropped: string[]}} Survivors as
 *   {title, full_name, year, start, end, city, link, type, topics, subjects,
 *   fit, why, evidence, sourceUrl}; one line per dropped event.
 */
export function validateEvents(events = [], { pageText, pageUrl, links = [], today }) {
  const haystack = normalize(pageText);
  const squashed = squash(pageText);
  const pageLinks = new Set(links.map((l) => l.href));
  const first = today.toISODate();
  const last = today.plus({ months: HORIZON_MONTHS }).toISODate();
  const out = [];
  const dropped = [];

  for (const ev of events) {
    const drop = (why) => dropped.push(`${ev.title} (${pageUrl}): ${why}`);
    if (EXCLUDED_KINDS.has(ev.kind)) { drop(`classed as ${ev.kind.replace(/_/g, ' ')}, which the criteria skip`); continue; }
    if (!ev.topics?.length) { drop('matches none of the topics'); continue; }
    const start = ev.start_date;
    const end = ev.end_date || start;
    if (!isValidDate(start) || !isValidDate(end) || end < start) {
      drop(`dates ${start} to ${ev.end_date} are not real YYYY-MM-DD dates`);
      continue;
    }
    if (start < first || start > last) { drop(`starts ${start}, outside ${first} to ${last}`); continue; }
    const quote = ev.dates_evidence ?? '';
    const shown = quote && haystack.includes(normalize(quote))
      ? conferenceDatesShown(start, end === start ? null : end, quote)
      : { start: false, end: false };
    const quoted = `"${quote.replace(/\s+/g, ' ').slice(0, 80)}"`;
    if (!shown.start) { drop(`dates ${start} are not shown in a quote from the page (${quoted})`); continue; }
    if (end !== start && !shown.end) { drop(`end date ${end} is not shown in ${quoted}; add it by hand`); continue; }
    const hours = end === start ? hoursShown(quote) : null;
    if (hours !== null && hours < MIN_SESSION_HOURS) { drop(`runs ${hours} hours, a session rather than an event`); continue; }
    const named = [ev.full_name, ev.title].some((n) => {
      const key = squash(n ?? '');
      return key.length >= MIN_SQUASHED_NAME ? squashed.includes(key) : key !== '' && mentions(haystack, n);
    });
    if (!named) { drop('its name is not on the page'); continue; }
    const city = cityOnPage(ev.city ?? '', haystack);
    if (!city) { drop(`city "${ev.city}" is not on the page or not in Switzerland`); continue; }

    let link = pageUrl;
    try {
      const candidate = normalizeUrl(ev.link);
      if (isAllowedUrl(candidate).ok && (candidate === pageUrl || pageLinks.has(candidate))) link = candidate;
    } catch { /* malformed; the page stands in */ }

    out.push({
      title: ev.title,
      full_name: ev.full_name && ev.full_name !== ev.title ? ev.full_name : null,
      year: DateTime.fromISO(start).year,
      start,
      end,
      city,
      link,
      type: ev.type,
      topics: ev.topics,
      subjects: ev.subjects?.length ? ev.subjects : ['Global Affairs'],
      fit: ev.fit,
      why: ev.why,
      evidence: quote,
      sourceUrl: pageUrl,
    });
  }
  return { events: out, dropped };
}
