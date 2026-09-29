import { useState, useEffect } from 'react';
import { fetchEvents } from '@/utils/eventData';
import type { Conference } from '@/types/conference';

interface UseConferencesReturn {
  conferences: Conference[];
  loading: boolean;
  error: string | null;
}

/** All events from the public data files, loaded once on mount. */
export function useConferences(): UseConferencesReturn {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents()
      .then(setConferences)
      .catch((err) => {
        console.error(err);
        setError('Could not load the conference data. Please try again later.');
      })
      .finally(() => setLoading(false));
  }, []);

  return { conferences, loading, error };
}
