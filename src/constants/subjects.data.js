/**
 * Raw subject data. Single source of truth for the subject taxonomy, shared by
 * the typed wrapper (src/constants/subjects.ts) and the Node data validator
 * (scripts/validate.js, which cannot import TypeScript).
 *
 * Plain ESM JavaScript on purpose. subjects.ts layers the TypeScript types and
 * derived lookup maps on top of these objects.
 */

/**
 * Subject color palettes (Tailwind-inspired). Define once and reference below.
 */
const SUBJECT_COLOR_PALETTES = {
  blue: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },      // ML
  purple: { bg: '#faf5ff', color: '#9333ea', border: '#e9d5ff' },    // CV
  green: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },     // NLP
  orange: { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },    // DM
  red: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },       // SP
  pink: { bg: '#fdf2f8', color: '#db2777', border: '#fbcfe8' },      // HCI
  cyan: { bg: '#ecfeff', color: '#0891b2', border: '#a5f3fc' },      // RO
  teal: { bg: '#f0fdfa', color: '#0d9488', border: '#99f6e4' },      // SEC
  indigo: { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe' },    // PRIV
  yellow: { bg: '#fefce8', color: '#a16207', border: '#fef08a' },    // CONF
  lime: { bg: '#f7fee7', color: '#65a30d', border: '#d9f99d' },      // SHOP
  violet: { bg: '#f5f3ff', color: '#7c3aed', border: '#ddd6fe' },    // CG
  fuchsia: { bg: '#fdf4ff', color: '#c026d3', border: '#f5d0fe' },   // KR
  rose: { bg: '#fff1f2', color: '#e11d48', border: '#fecdd3' },      // AP
};

/** Neutral fallback used when a subject has no palette of its own. */
export const DEFAULT_SUBJECT_COLOR = { bg: '#f9fafb', color: '#4b5563', border: '#e5e7eb' };

/** Complete subject configuration mapping. */
export const SUBJECTS = {
  ML: { code: 'ML', label: 'Machine Learning', emoji: '🤖', colors: SUBJECT_COLOR_PALETTES.blue },
  CV: { code: 'CV', label: 'Computer Vision', emoji: '👁️', colors: SUBJECT_COLOR_PALETTES.purple },
  NLP: { code: 'NLP', label: 'Natural Language Processing', emoji: '💬', colors: SUBJECT_COLOR_PALETTES.green },
  DM: { code: 'DM', label: 'Data Mining', emoji: '📊', colors: SUBJECT_COLOR_PALETTES.orange },
  HCI: { code: 'HCI', label: 'Human-Computer Interaction', emoji: '🖱️', colors: SUBJECT_COLOR_PALETTES.pink },
  SEC: { code: 'SEC', label: 'Security', emoji: '🔒', colors: SUBJECT_COLOR_PALETTES.teal },
  SE: { code: 'SE', label: 'Software Engineering', emoji: '⚙️', colors: SUBJECT_COLOR_PALETTES.rose },
  AI: { code: 'AI', label: 'Artificial Intelligence', emoji: '🧠', colors: SUBJECT_COLOR_PALETTES.indigo },
  'Global Health': { code: 'Global Health', label: 'Global Health', emoji: '🏥', colors: SUBJECT_COLOR_PALETTES.cyan },
  'Health AI': { code: 'Health AI', label: 'Health AI', emoji: '🏥', colors: SUBJECT_COLOR_PALETTES.violet },
};

/** Valid subject codes/tags, derived so this list can never drift from SUBJECTS. */
export const SUBJECT_CODES = Object.keys(SUBJECTS);
