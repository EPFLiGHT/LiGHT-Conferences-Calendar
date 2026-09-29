/**
 * URL Sync Utilities
 *
 * Utilities for synchronizing search query and filters with URL parameters.
 * Replaces the current history entry: the page reads the URL only on load.
 */

import { useSearchParams } from 'next/navigation';

interface URLSyncFilters {
  year?: string;
  subject?: string[];
  type?: string[];
}

interface UseURLSyncReturn {
  syncFiltersToURL: (searchQuery: string, filters: URLSyncFilters) => void;
  syncSearchToURL: (searchQuery: string, currentFilters: URLSyncFilters) => void;
}

export function useURLSync(basePath: string = ''): UseURLSyncReturn {
  const replaceURL = (params: URLSearchParams) => {
    if (typeof window === 'undefined') return;
    const newUrl = params.toString() ? `${basePath}?${params.toString()}` : basePath;
    window.history.replaceState({}, '', newUrl);
  };

  const buildParams = (searchQuery: string, filters: URLSyncFilters) => {
    const params = new URLSearchParams();

    if (searchQuery) params.set('q', searchQuery);
    if (filters.year) params.set('year', filters.year);
    if (filters.subject && filters.subject.length > 0) {
      params.set('subject', filters.subject.join(','));
    }
    if (filters.type && filters.type.length > 0) {
      params.set('type', filters.type.join(','));
    }

    return params;
  };

  const syncFiltersToURL = (searchQuery: string, filters: URLSyncFilters) => {
    const params = buildParams(searchQuery, filters);
    replaceURL(params);
  };

  const syncSearchToURL = (searchQuery: string, currentFilters: URLSyncFilters) => {
    const params = buildParams(searchQuery, currentFilters);
    replaceURL(params);
  };

  return {
    syncFiltersToURL,
    syncSearchToURL,
  };
}

/**
 * useInitialURLParams Hook
 *
 * Reads initial URL parameters and returns them.
 * Use this once on component mount to initialize state from URL.
 */
export function useInitialURLParams() {
  const searchParams = useSearchParams();

  const subjectParam = searchParams?.get('subject') || '';
  const typeParam = searchParams?.get('type') || '';

  return {
    searchQuery: searchParams?.get('q') || '',
    year: searchParams?.get('year') || '',
    subject: subjectParam ? subjectParam.split(',').filter(s => s.trim()) : [],
    type: typeParam ? typeParam.split(',').filter(t => t.trim()) : [],
  };
}
