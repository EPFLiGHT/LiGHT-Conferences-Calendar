/** Search query and filters mirrored in the page URL; the sort order stays out of it. */
export interface URLFilters {
  searchQuery: string;
  year: string;
  subject: string[];
  type: string[];
}

const list = (value: string | null) => (value ? value.split(',').filter((item) => item.trim()) : []);

export function filtersFromSearchParams(params: { get(name: string): string | null }): URLFilters {
  return {
    searchQuery: params.get('q') || '',
    year: params.get('year') || '',
    subject: list(params.get('subject')),
    type: list(params.get('type')),
  };
}

/** Writes the filters to the current URL, replacing the history entry so typing adds none. */
export function replaceURLFilters({ searchQuery, year, subject, type }: URLFilters): void {
  const params = new URLSearchParams();
  if (searchQuery) params.set('q', searchQuery);
  if (year) params.set('year', year);
  if (subject.length > 0) params.set('subject', subject.join(','));
  if (type.length > 0) params.set('type', type.join(','));

  const query = params.toString();
  const path = window.location.pathname;
  window.history.replaceState({}, '', query ? `${path}?${query}` : path);
}
