// Subject codes, labels, emojis and calendar colors; plain JS so Node scripts can import it.
// subjects.ts adds types and lookup maps.

/** Calendar color for events whose subject has none. */
export const DEFAULT_SUBJECT_COLOR = '#4b5563';

export const SUBJECTS = {
  ML: { label: 'Machine Learning', emoji: '🤖', color: '#2563eb' },
  CV: { label: 'Computer Vision', emoji: '👁️', color: '#9333ea' },
  NLP: { label: 'Natural Language Processing', emoji: '💬', color: '#16a34a' },
  DM: { label: 'Data Mining', emoji: '📊', color: '#ea580c' },
  HCI: { label: 'Human-Computer Interaction', emoji: '🖱️', color: '#db2777' },
  SEC: { label: 'Security', emoji: '🔒', color: '#0d9488' },
  SE: { label: 'Software Engineering', emoji: '⚙️', color: '#e11d48' },
  AI: { label: 'Artificial Intelligence', emoji: '🧠', color: '#4f46e5' },
  'Global Health': { label: 'Global Health', emoji: '🏥', color: '#0891b2' },
  'Health AI': { label: 'Health AI', emoji: '🏥', color: '#7c3aed' },
};

/** Valid values for an entry's `sub` field. */
export const SUBJECT_CODES = Object.keys(SUBJECTS);
