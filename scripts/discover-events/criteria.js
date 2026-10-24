/**
 * What counts as an event worth proposing. Both the search and the extraction
 * prompts are built from this file, so tuning the discovery means editing it.
 */

/** Topics an event must touch, keyed as the extraction schema reports them. */
export const TOPICS = {
  frontier_science: 'Frontier science and emerging technology',
  policy: 'Public policy and regulation',
  diplomacy: 'Diplomacy and international relations',
  geopolitics: 'Geopolitics and global governance',
  business: 'Business, investment and innovation',
  societal: 'Major societal and humanitarian challenges',
  foresight: 'Strategic foresight and the long-term future',
};

export const TOPIC_KEYS = Object.keys(TOPICS);

/**
 * What an event is, as the extraction classifies it. Classifying is easier for
 * a model than obeying a list of exclusions, so gates.js drops these kinds itself.
 */
export const KINDS = [
  'summit_or_forum', 'conference', 'symposium_or_dialogue', 'themed_week', 'workshop',
  'talk_or_seminar', 'course_or_training', 'webinar_or_online', 'official_body_session',
  'networking_or_career', 'trade_show', 'award_or_gala', 'cultural_or_sports', 'other',
];
export const EXCLUDED_KINDS = new Set([
  'talk_or_seminar', 'course_or_training', 'webinar_or_online', 'official_body_session',
  'networking_or_career', 'trade_show', 'award_or_gala', 'cultural_or_sports', 'other',
]);

/** How far ahead an event may start and still be proposed. */
export const HORIZON_MONTHS = 24;

export const CRITERIA = `We track high-level events held in person in Switzerland (Geneva, Zurich, Lausanne,
Basel, Bern, Davos and elsewhere) where leaders from science, government, diplomacy, international
organizations, business and civil society meet. GESDA's Anticipation Summit, the St. Gallen Symposium and
the World Economic Forum are typical. An event qualifies when it is held in Switzerland and touches at
least one of these topics:
${Object.values(TOPICS).map((t) => `- ${t}`).join('\n')}
Broad science and technology events qualify too, not only niche policy ones.
Never propose: courses, trainings or executive education; webinars or online-only events; single talks,
lectures or seminars; formal sessions of UN bodies, committees or expert groups; recruitment or job fairs;
product trade shows; startup pitch nights or local networking meetups; award ceremonies, galas,
festivals, cultural or sports events.`;
