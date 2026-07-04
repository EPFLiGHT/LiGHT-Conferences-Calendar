/**
 * Renders a sync run's outcome as markdown. The output is printed to the
 * console and becomes the body of the automated pull request, so it must
 * stay plain, human-readable markdown with no attribution of any kind.
 */

/**
 * Render the change report.
 * @param {object} run The accumulated run outcome.
 * @param {Array<{id: string, field: string, old: string|null, new: string}>} [run.updates]
 *   Field-level changes applied to existing entries.
 * @param {Array<{id: string, title: string, year: number}>} [run.drafts]
 *   Newly drafted editions.
 * @param {string[]} [run.flags] Items needing human attention (inferred end
 *   dates, year mismatches, fallback deadlines).
 * @param {string[]} [run.skipped] Venues skipped due to errors or missing data.
 * @returns {string} Markdown report; says "No changes." when nothing was written.
 */
export function renderReport({ updates = [], drafts = [], flags = [], skipped = [] }) {
  const lines = ['## OpenReview sync report', ''];
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
    for (const f of flags) lines.push(`- ${f}`);
    lines.push('');
  }
  if (skipped.length > 0) {
    lines.push('### Skipped', '');
    for (const s of skipped) lines.push(`- ${s}`);
    lines.push('');
  }
  return lines.join('\n');
}
