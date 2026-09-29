import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { filtersFromSearchParams, replaceURLFilters, type URLFilters } from '@/utils/urlSync';

const NONE: URLFilters = { searchQuery: '', year: '', subject: [], type: [] };

describe('replaceURLFilters', () => {
  const history = { pushState: vi.fn(), replaceState: vi.fn() };

  beforeEach(() => {
    history.pushState.mockClear();
    history.replaceState.mockClear();
    vi.stubGlobal('window', { history, location: { pathname: '/calendar' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the URL current without adding history entries while typing', () => {
    for (const q of ['m', 'ml', 'ml 2026']) replaceURLFilters({ ...NONE, searchQuery: q });

    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).toHaveBeenLastCalledWith({}, '', '/calendar?q=ml+2026');
  });

  it('keeps the URL current without adding history entries on filter changes', () => {
    replaceURLFilters({ ...NONE, year: '2026', subject: ['ML', 'NLP'] });
    replaceURLFilters(NONE);

    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState.mock.calls.map((c) => c[2])).toEqual([
      '/calendar?year=2026&subject=ML%2CNLP',
      '/calendar',
    ]);
  });

  it('writes to the current page path', () => {
    vi.stubGlobal('window', { history, location: { pathname: '/' } });
    replaceURLFilters({ ...NONE, type: ['summit', 'workshop'] });

    expect(history.replaceState).toHaveBeenLastCalledWith({}, '', '/?type=summit%2Cworkshop');
  });
});

describe('filtersFromSearchParams', () => {
  it('reads every filter from the query string', () => {
    const params = new URLSearchParams('q=ml&year=2026&subject=ML,NLP&type=conference');
    expect(filtersFromSearchParams(params)).toEqual({
      searchQuery: 'ml',
      year: '2026',
      subject: ['ML', 'NLP'],
      type: ['conference'],
    });
  });

  it('defaults missing params and drops empty list items', () => {
    expect(filtersFromSearchParams(new URLSearchParams('subject=ML,,'))).toEqual({
      ...NONE,
      subject: ['ML'],
    });
    expect(filtersFromSearchParams(new URLSearchParams(''))).toEqual(NONE);
  });

  it('round-trips through replaceURLFilters', () => {
    const history = { replaceState: vi.fn() };
    vi.stubGlobal('window', { history, location: { pathname: '/' } });
    const filters: URLFilters = { searchQuery: 'neur ips', year: '2027', subject: ['ML'], type: ['summit'] };

    replaceURLFilters(filters);
    const url = history.replaceState.mock.calls[0][2] as string;

    expect(filtersFromSearchParams(new URLSearchParams(url.split('?')[1]))).toEqual(filters);
    vi.unstubAllGlobals();
  });
});
