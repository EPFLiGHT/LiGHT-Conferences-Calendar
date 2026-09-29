import { useMemo } from 'react';
import { searchConferences, filterBySubjects, sortConferences, type SortBy } from '@/utils/conferenceQueries';
import type { Conference } from '@/types/conference';

export interface ConferenceFiltersState {
  sortBy: SortBy;
  year: string;
  subject: string[];
  type: string[];
}

/**
 * True when the search query or any narrowing filter is active.
 * Sort order is excluded: it reorders results but never hides any.
 */
export function hasActiveConferenceFilters(
  searchQuery: string,
  filters: ConferenceFiltersState
): boolean {
  return (
    searchQuery.trim() !== '' ||
    filters.year !== '' ||
    filters.subject.length > 0 ||
    filters.type.length > 0
  );
}

/** Conferences matching the search and filters, in the chosen sort order. */
export function useConferenceFilters(
  conferences: Conference[],
  searchQuery: string,
  filters: ConferenceFiltersState
): Conference[] {
  return useMemo(() => {
    // Shared query utilities keep web filtering in lockstep with the Slack bot.
    let result = filterBySubjects(searchConferences(conferences, searchQuery), filters.subject);
    if (filters.year) {
      result = result.filter(conf => conf.year === parseInt(filters.year));
    }
    if (filters.type.length > 0) {
      result = result.filter(conf => filters.type.includes(conf.type));
    }
    return sortConferences(result, filters.sortBy);
  }, [conferences, searchQuery, filters]);
}
