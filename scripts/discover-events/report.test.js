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
  venuesPath: 'scripts/sync-llm/venues.json',
};

describe('renderReport', () => {
  it('lists drafts by date, then possible fits, and prices the run', () => {
    const report = renderReport({
      ...base,
      proposals: [proposal('Later', '2027-06-01'), proposal('Sooner', '2027-02-01')],
      possible: [{ title: 'Maybe', start: '2027-01-01', end: '2027-01-02', city: 'Bern', country: 'Switzerland', why: 'Maybe fits.', link: 'https://maybe.example/' }],
      dropped: ['X: dropped'],
    });
    expect(report.indexOf('#### Sooner')).toBeLessThan(report.indexOf('#### Later'));
    expect(report).toContain('Geneva, Switzerland. Sooner fits.');
    expect(report).toContain('- **Maybe**, Jan 1-2, 2027, Bern, Switzerland: Maybe fits. https://maybe.example/');
    expect(report).toContain('Dropped by the checks (1)');
    // 0.40 + 0.20 for tokens, 0.02 for two searches.
    expect(report).toContain('est. $0.620');
  });

  it('asks the reviewer to delete a rejected draft\'s venue too', () => {
    const report = renderReport({ ...base, proposals: [proposal('Fest', '2027-03-01')] });
    expect(report).toContain('along with its entry in `scripts/sync-llm/venues.json`');
  });

  it('shows a draft\'s deadlines with their quotes, the checks to make and how the sync follows it', () => {
    const call = proposal('Call', '2027-02-01');
    call.entry.deadlines = [{ type: 'abstract', due: '2027-01-15 23:59' }];
    call.event.deadlines = [{ type: 'abstract', evidence: 'Abstracts due\n15 January 2027' }];
    call.event.deadlineFlags = ['2027 abstract deadline 2027-05-13: evidence names a later stage, not a deadline; dropped ("Abstract notification:\nfrom 1 December")'];
    call.follow = { cfg: { url: 'https://x.example/call' } };
    const fest = { ...proposal('Fest', '2027-03-01'), follow: { cfg: { url: 'https://x.example/', attendance: true } } };
    const known = { ...proposal('Known', '2027-04-01'), follow: { note: 'already followed' } };
    const report = renderReport({ ...base, proposals: [call, fest, known] });
    expect(report).toContain('- Deadline: Abstract, 2027-01-15 23:59 ("Abstracts due 15 January 2027")');
    expect(report).toContain('- Check: 2027 abstract deadline 2027-05-13: evidence names a later stage, not a deadline; dropped ("Abstract notification: from 1 December")');
    expect(report).toContain('- Deadline sync: follows https://x.example/call for its deadlines');
    expect(report).toContain('- Deadline sync: follows https://x.example/ for its dates and any call that opens');
    expect(report).toContain('- Deadline sync: already followed');
  });

  it('says when nothing new turned up', () => {
    expect(renderReport(base)).toContain('No new events to draft.');
  });
});
