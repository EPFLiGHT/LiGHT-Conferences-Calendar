import { DATA_FILES } from '@/constants/dataFiles';
import { parseConferences } from '@/utils/parser';
import type { Conference } from '@/types/conference';

/**
 * Fetch and parse every public/data events file served under `baseUrl`
 * ('' for the current origin).
 */
export async function fetchEvents(baseUrl = '', init?: RequestInit): Promise<Conference[]> {
  const responses = await Promise.all(
    DATA_FILES.map((name) => fetch(`${baseUrl}/data/${name}.yaml`, init))
  );
  if (responses.some((res) => !res.ok)) {
    throw new Error(`Failed to fetch data files: ${responses.map((res) => res.status).join(', ')}`);
  }
  const texts = await Promise.all(responses.map((res) => res.text()));
  return texts.flatMap(parseConferences);
}
