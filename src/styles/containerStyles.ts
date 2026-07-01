import { BoxProps } from '@chakra-ui/react';

// Only the style keys we set - spreading a narrow type onto a Framer MotionBox
// avoids dragging in DOM event handlers / `transition` that collide with Framer.
type SurfaceStyle = Pick<BoxProps, 'bg' | 'borderRadius' | 'border' | 'borderColor' | 'p'>;

/**
 * Standard white card surface: hairline brand border, card radius, padding.
 * Single source for the app's card/panel look - spread onto any Box.
 */
export const cardSurfaceStyle: SurfaceStyle = {
  bg: 'white',
  borderRadius: 'card',
  border: '1px solid',
  borderColor: 'line.default',
  p: '6',
};

/** Pagination shell reuses the standard card surface. */
export const paginationContainerStyle: SurfaceStyle = cardSurfaceStyle;
