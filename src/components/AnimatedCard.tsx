'use client';

import type { JSX } from 'react';
import { Box } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import { cardSurfaceStyle } from '@/styles/containerStyles';
import { brandAlpha } from '@/theme';

export const MotionBox = motion.create(Box);

const MOBILE_BREAKPOINT = 768;

interface AnimatedCardProps {
  /** Position in the grid; staggers the entrance. */
  index: number;
  onClick: () => void;
  children: React.ReactNode;
}

/** Clickable card surface that fades in on scroll and highlights its border on hover. */
export default function AnimatedCard({ index, onClick, children }: AnimatedCardProps): JSX.Element {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;
  const step = index % 12;

  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px', amount: 0.1 }}
      transition={{
        duration: isMobile ? 0.3 : 0.25,
        delay: step * (isMobile ? 0.03 : 0.02),
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      {...cardSurfaceStyle}
      cursor="pointer"
      position="relative"
      whileHover={{
        borderColor: brandAlpha(0.55),
        transition: { duration: 0.18, ease: 'easeOut' },
      }}
      onClick={onClick}
    >
      {children}
    </MotionBox>
  );
}
