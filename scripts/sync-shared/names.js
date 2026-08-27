/**
 * Gate for a source's full conference name: strips the edition decoration the
 * entry already carries in `title` and `year`, and rejects names that add
 * nothing to them.
 */

const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Normalize a source's full name for one entry, or reject it.
 * @param {string|null|undefined} raw Name as the source reports it.
 * @param {{title: string, year: number}} entry The entry it is meant for.
 * @returns {string|null} The cleaned name, or null when the source gave none
 *   or the name is only the title and year, or mostly uppercase.
 */
export function cleanFullName(raw, { title, year }) {
  if (!raw) return null;
  let s = raw.replace(/\s+/g, ' ').trim().replace(/\b(\d+) (st|nd|rd|th)\b/g, '$1$2');
  const yearRe = new RegExp(`[\\s,:-]*\\b${year}\\b$`);
  // A bracket holding only the acronym and/or the year, e.g. "(EMBC 2027)".
  const dropBracket = (m, inner) => {
    const rest = inner.replace(String(year), '').trim();
    return !rest || key(title).includes(key(rest)) ? '' : m;
  };
  for (let before = null; before !== s;) {
    before = s;
    s = s.replace(/\s*\(([^()]*)\)$/, dropBracket).replace(yearRe, '').trim();
  }
  if (!s || key(title).includes(key(s))) return null;
  const letters = s.replace(/[^A-Za-z]/g, '');
  const upper = letters.replace(/[^A-Z]/g, '');
  if (letters.length >= 12 && upper.length > letters.length / 2) return null;
  return s;
}

const UNITS = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth';
const TEENS = 'tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth';
const TENS = 'twent|thirt|fort|fift|sixt|sevent|eight|ninet';
const ORDINAL = `(?:\\d+(?:st|nd|rd|th)|${UNITS}|${TEENS}|(?:${TENS})ieth|(?:${TENS})y[\\s-](?:${UNITS}))`;
const DECORATION_RE = new RegExp(`^(?:the\\s+)?(?:${ORDINAL}\\s+)?(?:annual\\s+)?`, 'i');
const TRAILING_YEAR_RE = /[\s,:-]*\b(?:19|20)\d{2}$/;

/**
 * Whether two full names describe the same conference once edition decoration
 * (leading article, ordinal, "Annual", trailing year) is ignored.
 */
export function sameConferenceName(a, b) {
  const core = (s) => key(s.trim().replace(TRAILING_YEAR_RE, '').replace(DECORATION_RE, ''));
  return core(a) === core(b);
}
