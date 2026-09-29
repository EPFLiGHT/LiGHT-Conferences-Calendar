import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { filtersFromSearchParams, replaceURLFilters } from '@/utils/urlSync';
import type { ConferenceFiltersState } from './useConferenceFilters';

/**
 * Search query and filters, seeded from the URL on load and written back on every change.
 * `onChange` runs after each change, e.g. to reset pagination. Needs a Suspense boundary.
 */
export function useConferenceFilterState(onChange?: () => void) {
  const initial = filtersFromSearchParams(useSearchParams());
  const [searchQuery, setSearchQuery] = useState(initial.searchQuery);
  const [filters, setFilters] = useState<ConferenceFiltersState>({
    sortBy: 'deadline',
    year: initial.year,
    subject: initial.subject,
    type: initial.type,
  });

  const apply = (nextQuery: string, nextFilters: ConferenceFiltersState) => {
    setSearchQuery(nextQuery);
    setFilters(nextFilters);
    replaceURLFilters({ ...nextFilters, searchQuery: nextQuery });
    onChange?.();
  };

  return {
    searchQuery,
    filters,
    setSearchQuery: (query: string) => apply(query, filters),
    updateFilters: (partial: Partial<ConferenceFiltersState>) => apply(searchQuery, { ...filters, ...partial }),
    resetFilters: () => apply('', { ...filters, year: '', subject: [], type: [] }),
  };
}
