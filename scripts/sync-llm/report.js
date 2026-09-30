/**
 * The report sections only this sync has, appended after the shared report:
 * the page quote behind each deadline written, and what each venue cost.
 */

// gpt-5.6-sol list prices, USD per million tokens.
const INPUT_PRICE_PER_M = 5;
const OUTPUT_PRICE_PER_M = 30;

/**
 * @param {{evidence: Array<{id: string, field: string, quote: string, url: string}>,
 *   usageByVenue: Object<string, {tier: number|null, outcome: string|null,
 *   inputTokens: number, outputTokens: number}>,
 *   totals: {inputTokens: number, outputTokens: number}}} args
 * @returns {string} Markdown.
 */
export function renderExtraSections({ evidence, usageByVenue, totals }) {
  const lines = [];
  if (evidence.length > 0) {
    lines.push('### Evidence', '', '| Entry | Field | Source quote | Page |', '|---|---|---|---|');
    for (const e of evidence) {
      // Quotes span table rows and headings, so they carry newlines and pipes;
      // either one would break out of the markdown row.
      const quote = e.quote.replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim().slice(0, 200);
      lines.push(`| ${e.id} | ${e.field} | ${quote} | ${e.url} |`);
    }
    lines.push('');
  }
  lines.push('### Usage', '');
  for (const [venue, u] of Object.entries(usageByVenue)) {
    // "tier N" alone reads as success; empty-handed venues must not look synced.
    const where =
      u.tier == null ? 'failed'
      : u.outcome === 'submitted' ? `tier ${u.tier}`
      : `tier ${u.tier}, found nothing`;
    lines.push(`- ${venue}: ${where}, ${u.inputTokens + u.outputTokens} tokens`);
  }
  const cost =
    (totals.inputTokens * INPUT_PRICE_PER_M + totals.outputTokens * OUTPUT_PRICE_PER_M) / 1_000_000;
  lines.push(
    '',
    `Total: ${totals.inputTokens} input + ${totals.outputTokens} output tokens, est. $${cost.toFixed(3)}`,
    '',
  );
  return lines.join('\n');
}
