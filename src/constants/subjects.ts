import { SUBJECTS as SUBJECTS_DATA, DEFAULT_SUBJECT_COLOR } from './subjects.data';

interface SubjectConfig {
  label: string;
  emoji: string;
  color: string;
}

const SUBJECTS: Record<string, SubjectConfig> = SUBJECTS_DATA;

export { DEFAULT_SUBJECT_COLOR };

const mapSubjects = <T>(pick: (s: SubjectConfig) => T): Record<string, T> =>
  Object.fromEntries(Object.entries(SUBJECTS).map(([code, s]) => [code, pick(s)]));

export const SUBJECT_LABELS = mapSubjects((s) => s.label);
export const SUBJECT_COLORS = mapSubjects((s) => s.color);
export const SUBJECT_EMOJIS = mapSubjects((s) => s.emoji);

/**
 * Resolve free-form user input (any case, padded) to a canonical subject code,
 * or null if it matches none. Codes are mixed-case ("Global Health").
 */
export function resolveSubjectCode(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;
  return Object.keys(SUBJECTS).find(code => code.toLowerCase() === normalized) ?? null;
}
