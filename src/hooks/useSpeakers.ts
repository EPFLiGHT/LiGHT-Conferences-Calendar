import { useState, useEffect } from 'react';
import { load } from 'js-yaml';
import type { Speaker } from '@/types/speaker';

export async function fetchSpeakers(): Promise<Speaker[]> {
  const response = await fetch('/data/speakers.yaml');
  if (!response.ok) {
    throw new Error('Failed to fetch speakers data');
  }
  return load(await response.text()) as Speaker[];
}

interface UseSpeakersReturn {
  speakers: Speaker[];
  loading: boolean;
  error: string | null;
}

/** All speakers from public/data/speakers.yaml, loaded once on mount. */
export function useSpeakers(): UseSpeakersReturn {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpeakers()
      .then(setSpeakers)
      .catch((err) => {
        console.error(err);
        setError('Could not load the speakers. Please try again later.');
      })
      .finally(() => setLoading(false));
  }, []);

  return { speakers, loading, error };
}
