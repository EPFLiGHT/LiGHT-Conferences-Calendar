import { describe, it, expect } from 'vitest';
import { renderReport } from './report.js';

const proposal = (title, start) => ({
  event: { why: `${title} fits.`, topics: ['foresight'], sourceUrl: 'https://src.example/', origin: 'Src', evidence: 'quote' },
  entry: { title, id: `${title.toLowerCase()}27`, date: 'Apr 28-29, 2027', place: 'Geneva, Switzerland', link: 'https://x.example/', start },
  file: 'summits.yaml',
});

const base = {
  proposals: [], possible: [], attention: [], dropped: [], stats: { pages: 3, searches: 2 },
  totals: { inputTokens: 100_000, outputTokens: 10_000 }, seenPath: 'scripts/discover-events/seen.json',
};

describe('renderReport', () => {
  it('lists drafts by date, then possible fits, and prices the run', () => {
    const report = renderReport({
      ...base,
      proposals: [proposal('Later', '2027-06-01'), proposal('Sooner', '2027-02-01')],
      possible: [{ title: 'Maybe', start: '2027-01-01', end: '2027-01-02', city: 'Bern', why: 'Maybe fits.', link: 'https://maybe.example/' }],
      dropped: ['X: dropped'],
    });
    expect(report.indexOf('#### Sooner')).toBeLessThan(report.indexOf('#### Later'));
    expect(report).toContain('Geneva, Switzerland. Sooner fits.');
    expect(report).toContain('- **Maybe**, Jan 1-2, 2027, Bern: Maybe fits. https://maybe.example/');
    expect(report).toContain('Dropped by the checks (1)');
    // 0.40 + 0.20 for tokens, 0.02 for two searches.
    expect(report).toContain('est. $0.620');
  });

  it('says when nothing new turned up', () => {
    expect(renderReport(base)).toContain('No new events to draft.');
  });
});
