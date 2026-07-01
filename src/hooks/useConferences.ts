/**
 * useConferences Hook
 *
 * Custom hook that fetches and manages conference data from multiple YAML sources.
 * Consolidates conferences, summits, and workshops into a unified list.
 *
 * @returns Object with conferences array, loading state, and error message
 */

import { useState, useEffect } from 'react';
import { parseConferences } from '@/utils/parser';
import { DATA_FILES } from '@/constants/dataFiles';
import type { Conference } from '@/types/conference';

interface UseConferencesReturn {
  conferences: Conference[];
  loading: boolean;
  error: string | null;
}

export function useConferences(): UseConferencesReturn {
  const [conferences, setConferences] = useState<Conference[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const responses = await Promise.all(
          DATA_FILES.map((name) => fetch(`/data/${name}.yaml`))
        );

        if (responses.some((res) => !res.ok)) {
          throw new Error('Failed to fetch data files');
        }

        const texts = await Promise.all(responses.map((res) => res.text()));
        const allData = texts.flatMap((text) => parseConferences(text));

        setConferences(allData);
        setLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        setLoading(false);
      }
    };

    fetchAllData();
  }, []);

  return { conferences, loading, error };
}
