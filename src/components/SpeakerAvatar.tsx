'use client';

import type { JSX } from 'react';
import { useState, useEffect } from 'react';
import { Box, Flex, Image } from '@chakra-ui/react';
import { UserRound } from 'lucide-react';
import { brandAlpha } from '@/theme';

interface SpeakerAvatarProps {
  imageUrl?: string | string[];
  /** Comma-separated for a team; each name gets a slot, with a placeholder when photos run out. */
  name: string;
  size: 'sm' | 'md';
}

const BLACK_SHADOW = '0 4px 12px rgba(0, 0, 0, 0.15)';

const SIZES = {
  sm: {
    avatar: 60,
    icon: 28,
    overlap: 24,
    placeholderBg: 'gray.100',
    hoverScale: 'scale(1.1)',
    soloShadow: `0 2px 8px ${brandAlpha(0.15)}`,
    photoShadow: `0 2px 8px ${brandAlpha(0.2)}`,
    activeShadow: `0 4px 16px ${brandAlpha(0.4)}`,
    placeholderShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
  },
  md: {
    avatar: 70,
    icon: 32,
    overlap: 20,
    placeholderBg: 'white',
    hoverScale: 'scale(1.15)',
    soloShadow: BLACK_SHADOW,
    photoShadow: BLACK_SHADOW,
    // The glow lightens the overlapped neighbors in a team stack.
    activeShadow: '0 6px 20px rgba(255, 255, 255, 0.5)',
    placeholderShadow: BLACK_SHADOW,
  },
} as const;

/** Round speaker photo, or an overlapping stack for a team; hovering a stack cycles the front photo. */
export default function SpeakerAvatar({ imageUrl, name, size }: SpeakerAvatarProps): JSX.Element {
  const [isHovering, setIsHovering] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const s = SIZES[size];
  const urls = imageUrl ? [imageUrl].flat() : [];
  const slots = Math.max(name.split(',').length, urls.length);
  const placeholders = slots - urls.length;
  const solo = slots === 1;
  const cycling = isHovering && urls.length > 1;

  useEffect(() => {
    if (!cycling) {
      setActiveImageIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setActiveImageIndex((prev) => (prev + 1) % urls.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [cycling, urls.length]);

  return (
    <Flex
      position="relative"
      minW={`${slots * s.overlap + (s.avatar - s.overlap)}px`}
      minH={`${s.avatar}px`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {Array.from({ length: slots }, (_, slot) => {
        const photo = slot - placeholders;
        const url = urls[photo];
        const active = cycling && photo === activeImageIndex;
        // A lone small avatar sits on the card without the white ring.
        const ringed = !solo || size === 'md';
        const shared = {
          position: 'absolute',
          left: `${slot * s.overlap}px`,
          w: `${s.avatar}px`,
          h: `${s.avatar}px`,
          borderRadius: 'full',
          border: ringed ? '3px solid white' : undefined,
          zIndex: active ? slots + 10 : slots - slot,
        } as const;

        if (!url) {
          return (
            <Box
              key={slot}
              {...shared}
              bg={s.placeholderBg}
              color="brand.500"
              p="4"
              display="flex"
              alignItems="center"
              justifyContent="center"
              boxShadow={ringed ? s.placeholderShadow : undefined}
            >
              <UserRound size={s.icon} strokeWidth={1.5} />
            </Box>
          );
        }

        return (
          <Box
            key={slot}
            {...shared}
            overflow="hidden"
            boxShadow={active ? s.activeShadow : solo ? s.soloShadow : s.photoShadow}
            transition="all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
            transform={active ? s.hoverScale : 'scale(1)'}
          >
            <Image
              src={url}
              alt={solo ? name : `${name} - ${photo + 1}`}
              w={`${s.avatar}px`}
              h={`${s.avatar}px`}
              objectFit="cover"
            />
          </Box>
        );
      })}
    </Flex>
  );
}
