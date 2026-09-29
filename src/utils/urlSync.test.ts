import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useURLSync } from '@/utils/urlSync';

describe('useURLSync', () => {
  const history = { pushState: vi.fn(), replaceState: vi.fn() };

  beforeEach(() => {
    history.pushState.mockClear();
    history.replaceState.mockClear();
    vi.stubGlobal('window', { history });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the URL current without adding history entries while typing', () => {
    const { syncSearchToURL } = useURLSync('/calendar');
    for (const q of ['m', 'ml', 'ml 2026']) syncSearchToURL(q, {});

    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState).toHaveBeenLastCalledWith({}, '', '/calendar?q=ml+2026');
  });

  it('keeps the URL current without adding history entries on filter changes', () => {
    const { syncFiltersToURL } = useURLSync('/calendar');
    syncFiltersToURL('', { year: '2026', subject: ['ML', 'NLP'], type: [] });
    syncFiltersToURL('', {});

    expect(history.pushState).not.toHaveBeenCalled();
    expect(history.replaceState.mock.calls.map((c) => c[2])).toEqual([
      '/calendar?year=2026&subject=ML%2CNLP',
      '/calendar',
    ]);
  });
});
