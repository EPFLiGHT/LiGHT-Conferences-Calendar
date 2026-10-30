/**
 * What counts as an event worth proposing. Both the search and the extraction
 * prompts are built from this file, so tuning the discovery means editing it.
 */

/**
 * Topics an event must touch, keyed as the extraction schema reports them.
 * Searched in this order, closest fits first, since the run caps the leads it reads.
 */
export const TOPICS = {
  humanitarian: 'Humanitarian aid and international cooperation',
  global_health: 'Global health and primary care',
  ai_digital: 'AI, robotics and digital technology',
  governance: 'Diplomacy, peace and global governance',
  frontier_science: 'Frontier science and its impact on society',
  societal: 'Public policy and major societal challenges',
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

/** The examples are events the reviewer rated over 80% fit, kept, or rejected. */
export const CRITERIA = `We track high-level events held in person in Switzerland (Geneva, Zurich, Lausanne,
Basel, Bern, Davos and elsewhere) where leaders from government, international organizations, NGOs, science
and civil society meet. An event qualifies when it is held in Switzerland and touches at least one of these
topics:
${Object.values(TOPICS).map((t) => `- ${t}`).join('\n')}
Closest fits are events on international cooperation, humanitarian aid, global health or the governance of AI,
often convened by the Swiss government, International Geneva, UN agencies or major NGOs: the IC Forum, the
Geneva AI Summit, GESDA's Anticipation Summit and the Medicus Mundi Switzerland Symposium are typical.
Also wanted: AI, robotics and digital technology events (Swiss Robotics Day, GenAI Zürich, AI+X Summit,
digitalswitzerland @ Davos), life sciences and health technology events (Swiss Biotech Day, the Swiss
Symposium in Point-of-Care Diagnostics), peace forums (Basel Peace Forum), cross-sector leaders' dialogues
(St. Gallen Symposium) and national forums on social challenges such as migration, poverty or health
(Caritas-Forum).
Skip events mainly about business, finance or investment (economic or trade forums, engineering or
manufacturing industry days, startup and investor summits, crypto and digital assets), gatherings of one
research or industry community outside AI, digital technology, health and life sciences (quantum, space),
and academic or learned-society conferences outside global health and AI, such as on ethics or philosophy.
Never propose: courses, trainings or executive education; webinars or online-only events; single talks,
lectures or seminars; formal sessions of UN bodies, committees or expert groups; recruitment or job fairs;
product trade shows; startup pitch nights or local networking meetups; award ceremonies, galas,
festivals, cultural or sports events.`;
