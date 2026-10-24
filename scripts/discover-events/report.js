/**
 * The run as markdown, printed and used as the pull request body. Drafted
 * events come first, in words a reviewer outside the team can read, then the
 * possible fits that were not drafted; what the checks dropped is folded away.
 */
import { formatDateRange } from '../sync-shared/dates.js';
import { estimateCost } from '../sync-llm/llm.js';
import { TOPICS } from './criteria.js';

// USD per web_search call, on any model; the results it reads are billed as input tokens.
const SEARCH_PRICE = 0.01;

/**
 * @param {{proposals: Array<{event: object, entry: object, file: string}>, possible: Array<object>,
 *   attention: string[], dropped: string[], stats: {pages: number, searches: number},
 *   totals: {inputTokens: number, outputTokens: number}, seenPath: string}} run
 * @returns {string}
 */
export function renderReport({ proposals, possible, attention, dropped, stats, totals, seenPath }) {
  const lines = ['## Swiss event discovery', ''];
  if (proposals.length === 0) {
    lines.push('No new events to draft.', '');
  } else {
    lines.push(
      `${proposals.length} new event${proposals.length === 1 ? '' : 's'} drafted in this PR. ` +
        `Delete the drafts that do not fit before merging; every draft is remembered in \`${seenPath}\`, ` +
        'so a deleted one is not proposed again.',
      '',
    );
    const sorted = [...proposals].sort((a, b) => a.entry.start.localeCompare(b.entry.start));
    for (const { event, entry, file } of sorted) {
      const name = entry.full_name && entry.full_name !== entry.title ? `${entry.title} (${entry.full_name})` : entry.title;
      lines.push(
        `#### ${name}`,
        '',
        `${entry.date}, ${entry.place}. ${event.why}`,
        '',
        `- Topics: ${event.topics.map((t) => TOPICS[t]).join('; ')}`,
        `- Link: ${entry.link}`,
        `- Found on ${event.sourceUrl} (${event.origin}): "${event.evidence.replace(/\s+/g, ' ')}"`,
        `- Draft: \`${entry.id}\` in ${file}`,
        '',
      );
    }
  }
  if (possible.length > 0) {
    lines.push('### Possible fits, not drafted', '');
    for (const e of [...possible].sort((a, b) => a.start.localeCompare(b.start))) {
      lines.push(`- **${e.title}**, ${formatDateRange(e.start, e.end)}, ${e.city}: ${e.why} ${e.link}`);
    }
    lines.push('');
  }
  if (attention.length > 0) {
    lines.push('### Needs attention', '');
    for (const a of new Set(attention)) lines.push(`- ${a}`);
    lines.push('');
  }
  if (dropped.length > 0) {
    lines.push(`<details><summary>Dropped by the checks (${dropped.length})</summary>`, '');
    for (const d of dropped) lines.push(`- ${d}`);
    lines.push('', '</details>', '');
  }
  const cost = estimateCost(totals) + stats.searches * SEARCH_PRICE;
  lines.push(
    '### Usage',
    '',
    `${stats.pages} pages read, ${stats.searches} web searches. ` +
      `${totals.inputTokens} input + ${totals.outputTokens} output tokens, est. $${cost.toFixed(3)}`,
    '',
  );
  return lines.join('\n');
}
