/**
 * Combines one venue's main page and extra pages (registration, fees,
 * scholarships) into one list of editions before anything is merged. Pages of
 * one venue can disagree with each other (a guide and a call page dating the
 * same call differently): then neither date is trusted.
 */
import { parseDeadline } from './facts.js';

/**
 * @param {{title: string, main: Array<object>, extras: Array<{year: number, deadlines: Array<object>}>,
 *   knownYears: Set<number>, zone?: string}} args main are the main page's validated
 *   editions; extras the extra pages' (year and deadlines only); knownYears the years
 *   the data already has an entry for; zone the venue's entry timezone.
 * @returns {{editions: Array<object>, flags: string[]}} An extra-page year joins the
 *   main edition of that year, or stands alone when the data has it; it never
 *   starts a draft. Per year and type, deadlines due the same day in `zone` collapse
 *   to the first (main page first); different days drop that type.
 */
export function combineEditions({ title, main, extras, knownYears, zone = 'utc' }) {
  if (extras.length === 0) return { editions: main, flags: [] };
  const flags = [];
  const byYear = new Map(main.map((e) => [e.year, { ...e, deadlines: [...e.deadlines] }]));
  for (const extra of extras) {
    let edition = byYear.get(extra.year);
    if (!edition) {
      if (!knownYears.has(extra.year)) {
        flags.push(
          `${title}: ${extra.year} deadlines on ${extra.deadlines[0]?.source} match no edition on the main page or in the data; not drafted from an extra page`,
        );
        continue;
      }
      edition = {
        year: extra.year, full_name: null, location: null, start_date: null, end_date: null, dates_evidence: null, deadlines: [],
      };
      byYear.set(extra.year, edition);
    }
    edition.deadlines.push(...extra.deadlines);
  }

  const editions = [...byYear.values()].map((edition) => {
    const deadlines = [];
    // "until 14 October" and "before 15 October" are one day; "15 October" with and without "before" are not.
    const dayOf = (d) => parseDeadline(d, zone)?.setZone(zone).toISODate() ?? d.date;
    for (const type of new Set(edition.deadlines.map((d) => d.type))) {
      const same = edition.deadlines.filter((d) => d.type === type);
      if (same.every((d) => dayOf(d) === dayOf(same[0]))) {
        deadlines.push(same[0]);
      } else {
        const where = same.map((d) => `${dayOf(d)} on ${d.source}`).join(', ');
        flags.push(`${title}: ${edition.year} ${type} deadline differs between pages (${where}); left out, check by hand`);
      }
    }
    return { ...edition, deadlines };
  });
  return { editions, flags };
}
