/**
 * useConferenceFilters Hook
 *
 * Custom hook that handles filtering and sorting of conferences.
 * Supports search, year filter, subject filter, and three sorting modes.
 *
 * @param conferences - Array of conferences to filter
 * @param searchQuery - Search query string
 * @param filters - Filter object with sortBy, year, and subject
 * @returns Filtered and sorted array of conferences
 */

import { useMemo } from 'react';
import { DateTime } from 'luxon';
import { getNextDeadline } from '@/utils/parser';
import { searchConferences, filterBySubjects } from '@/utils/conferenceQueries';
import type { Conference } from '@/types/conference';

export interface ConferenceFiltersState {
  sortBy: string;
  year: string;
  subject: string[];
  type: string[];
}

export function useConferenceFilters(
  conferences: Conference[],
  searchQuery: string,
  filters: ConferenceFiltersState
) {
  return useMemo(() => {
    // Shared query utilities keep web filtering in lockstep with the Slack bot.
    // Copy first: the helpers pass the input through untouched when their
    // filter is empty, and the sort below mutates in place.
    let result = searchConferences([...conferences], searchQuery);
    result = filterBySubjects(result, filters.subject ?? []);

    // Apply year filter
    if (filters.year) {
      result = result.filter(conf => conf.year === parseInt(filters.year));
    }

    // Apply type filter (multi-select)
    if (filters.type && filters.type.length > 0) {
      result = result.filter(conf => filters.type.includes(conf.type));
    }

    // Apply sorting
    result.sort((a, b) => {
      if (filters.sortBy === 'deadline') {
        const aNext = getNextDeadline(a);
        const bNext = getNextDeadline(b);
        const now = DateTime.now();
        const nowMs = now.toMillis();

        // An event is "upcoming" if it hasn't ended yet (or has no end date but
        // a future start, or only has a year >= current year).
        const eventEndMs = (c: Conference): number => {
          if (c.end) return DateTime.fromISO(c.end).endOf('day').toMillis();
          if (c.start) return DateTime.fromISO(c.start).endOf('day').toMillis();
          // Fall back to end-of-year so a 2027-only entry still counts as future.
          return DateTime.fromObject({ year: c.year }).endOf('year').toMillis();
        };
        const eventStartMs = (c: Conference): number => {
          if (c.start) return DateTime.fromISO(c.start).toMillis();
          if (c.end) return DateTime.fromISO(c.end).toMillis();
          return DateTime.fromObject({ year: c.year }).toMillis();
        };

        // Tier 0: upcoming deadline
        // Tier 1: no deadline, event still upcoming
        // Tier 2: expired deadline
        // Tier 3: no deadline, event already passed
        const tier = (c: Conference, next: typeof aNext): 0 | 1 | 2 | 3 => {
          if (next) return next.localDatetime > now ? 0 : 2;
          return eventEndMs(c) >= nowMs ? 1 : 3;
        };
        const aTier = tier(a, aNext);
        const bTier = tier(b, bNext);

        if (aTier !== bTier) return aTier - bTier;

        if (aTier === 0) {
          // Both upcoming deadlines: nearest first
          return aNext!.datetime.toMillis() - bNext!.datetime.toMillis();
        }
        if (aTier === 1) {
          // No deadline, both future: concrete starts first (soonest first),
          // then year-only / TBA entries by year ascending.
          const aTBA = !a.start && !a.end;
          const bTBA = !b.start && !b.end;
          if (aTBA !== bTBA) return aTBA ? 1 : -1;
          if (aTBA && bTBA) return a.year - b.year;
          return eventStartMs(a) - eventStartMs(b);
        }
        if (aTier === 2) {
          // Both expired: most recently passed first
          return bNext!.datetime.toMillis() - aNext!.datetime.toMillis();
        }
        // Both past events with no deadline: most recent first
        return eventStartMs(b) - eventStartMs(a);
      } else if (filters.sortBy === 'hindex') {
        return (b.hindex || 0) - (a.hindex || 0);
      } else if (filters.sortBy === 'start') {
        const aStart = a.start ? DateTime.fromISO(a.start) : DateTime.fromMillis(0);
        const bStart = b.start ? DateTime.fromISO(b.start) : DateTime.fromMillis(0);
        return bStart.toMillis() - aStart.toMillis();
      }
      return 0;
    });

    return result;
  }, [conferences, searchQuery, filters]);
}
