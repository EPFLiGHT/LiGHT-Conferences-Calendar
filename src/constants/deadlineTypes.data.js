// Deadline types, their labels and groups; plain JS so Node scripts can import it.
// deadlineTypes.ts adds types and label helpers.

/** `other` has no default label: its item must carry one. */
export const DEADLINE_TYPES = {
  paper_abstract: { label: 'Paper abstract', short: 'Abstract', group: 'submission' },
  paper: { label: 'Full paper', short: 'Paper', group: 'submission' },
  abstract: { label: 'Abstract', short: 'Abstract', group: 'submission' },
  poster: { label: 'Poster abstract', short: 'Poster', group: 'submission' },
  late_breaking: { label: 'Late-breaking abstract', short: 'Late-breaking', group: 'submission' },
  proposal: { label: 'Session proposal', short: 'Proposal', group: 'submission' },
  other: { label: null, short: null, group: 'submission' },
  early_registration: { label: 'Early-bird registration', short: 'Early-bird', group: 'registration' },
  registration: { label: 'Registration closes', short: 'Registration', group: 'registration' },
  presenter_registration: { label: 'Presenter registration', short: 'Presenter reg.', group: 'registration' },
  grant: { label: 'Scholarship or travel grant', short: 'Grant', group: 'funding' },
};

export const DEADLINE_GROUPS = {
  submission: { label: 'Submission', emoji: '📝' },
  registration: { label: 'Registration', emoji: '🎫' },
  funding: { label: 'Funding', emoji: '💰' },
};

/** Valid values for a deadline item's `type`. */
export const DEADLINE_TYPE_CODES = Object.keys(DEADLINE_TYPES);

/** Types a source and a hand-check most often disagree on; the syncs match them to each other. */
export const ABSTRACT_FAMILY = ['paper_abstract', 'abstract', 'poster'];
