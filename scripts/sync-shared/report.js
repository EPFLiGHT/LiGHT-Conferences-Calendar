/**
 * Renders a sync run's outcome as markdown. The output is printed to the
 * console and becomes the body of the automated pull request.
 */

const OUTCOME_KEYS = ['updates', 'drafts', 'flags', 'skipped'];

/** @returns {{updates: [], drafts: [], flags: [], skipped: []}} An outcome with nothing in it. */
export function emptyOutcome() {
  return Object.fromEntries(OUTCOME_KEYS.map((key) => [key, []]));
}

/**
 * Append one outcome to another; keys missing from `from` add nothing.
 * @param {object} into Outcome to extend (mutated).
 * @param {object} from Outcome to append.
 * @returns {object} into.
 */
export function addOutcome(into, from) {
  for (const key of OUTCOME_KEYS) into[key].push(...(from[key] ?? []));
  return into;
}

/**
 * Render the change report.
 * @param {object} run The accumulated run outcome.
 * @param {string} run.title Report heading; each sync passes its own.
 * @param {Array<{id: string, field: string, old: string|null, new: string}>} [run.updates]
 *   Field-level changes applied to existing entries.
 * @param {Array<{id: string, title: string, year: number}>} [run.drafts]
 *   Newly drafted editions.
 * @param {string[]} [run.flags] Items needing human attention (pinned or
 *   curated values the source disagrees with, year mismatches, missing facts).
 * @param {string[]} [run.skipped] Venues skipped due to errors or missing data.
 * @returns {string} Markdown report; says "No changes." when nothing was written.
 */
export function renderReport({ title, updates = [], drafts = [], flags = [], skipped = [] }) {
  const lines = [`## ${title}`, ''];
  if (updates.length === 0 && drafts.length === 0) {
    lines.push('No changes.', '');
  }
  if (updates.length > 0) {
    lines.push('### Updated entries', '', '| Entry | Field | Old | New |', '|---|---|---|---|');
    for (const c of updates) {
      lines.push(`| ${c.id} | ${c.field} | ${c.old ?? ''} | ${c.new} |`);
    }
    lines.push('');
  }
  if (drafts.length > 0) {
    lines.push('### New editions drafted', '');
    for (const d of drafts) lines.push(`- ${d.id} (${d.title} ${d.year})`);
    lines.push('');
  }
  if (flags.length > 0) {
    lines.push('### Needs attention', '');
    // A venue reporting the same year twice raises the same flag twice.
    for (const f of new Set(flags)) lines.push(`- ${f}`);
    lines.push('');
  }
  if (skipped.length > 0) {
    lines.push('### Skipped', '');
    for (const s of skipped) lines.push(`- ${s}`);
    lines.push('');
  }
  return lines.join('\n');
}
