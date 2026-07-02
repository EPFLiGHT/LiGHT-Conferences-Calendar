/**
 * Unified Subject Configuration
 * Single source of truth for all subject-related constants.
 *
 * The raw data lives in ./subjects.data.js (plain ESM) so the Node validator
 * can share it; this file layers the TypeScript types and derived lookup maps.
 */

import { SUBJECTS as SUBJECTS_DATA, DEFAULT_SUBJECT_COLOR } from './subjects.data';

interface SubjectConfig {
  code: string;
  label: string;
  emoji: string;
  colors: {
    bg: string;
    color: string;
    border: string;
  };
}

const SUBJECTS: Record<string, SubjectConfig> = SUBJECTS_DATA;

export { DEFAULT_SUBJECT_COLOR };

/**
 * Derived exports for backward compatibility
 */
export const SUBJECT_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(SUBJECTS).map(([k, v]) => [k, v.label])
);

export const SUBJECT_COLORS: Record<string, { bg: string; color: string; border: string }> =
  Object.fromEntries(Object.entries(SUBJECTS).map(([k, v]) => [k, v.colors]));

export const SUBJECT_EMOJIS: Record<string, string> = Object.fromEntries(
  Object.entries(SUBJECTS).map(([k, v]) => [k, v.emoji])
);

/**
 * Resolve free-form user input (any case, padded) to a canonical subject code,
 * or null if it matches none. Needed because codes are mixed-case
 * ("Global Health", "Health AI") while users type them however they like.
 */
export function resolveSubjectCode(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  return Object.keys(SUBJECTS).find(code => code.toLowerCase() === normalized) ?? null;
}
