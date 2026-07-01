/**
 * useCardAnimation
 *
 * Single source for the staggered card entrance timing used by ConferenceCard
 * and SpeakerCard. Keeps the mobile breakpoint and stagger math in one place.
 */

interface CardAnimation {
  animationDelay: number;
  animationDuration: number;
}

const MOBILE_BREAKPOINT = 768;

export function useCardAnimation(index: number): CardAnimation {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
  return {
    animationDelay: isMobile ? (index % 12) * 0.03 : (index % 12) * 0.02,
    animationDuration: isMobile ? 0.3 : 0.25,
  };
}
