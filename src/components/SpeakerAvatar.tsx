'use client';

import type { JSX } from 'react';
import { useState, useEffect } from 'react';
import { Box, Flex, Image, type BoxProps } from '@chakra-ui/react';
import { UserRound } from 'lucide-react';
import { COLORS, brandAlpha } from '@/theme';

interface PlaceholderCircleProps extends BoxProps {
  size: 'sm' | 'md' | 'lg';
  iconSize: number;
}

/** Circular no-photo fallback: person icon on a light disc. */
function PlaceholderCircle({ size, iconSize, ...boxProps }: PlaceholderCircleProps): JSX.Element {
  return (
    <Box
      bg={size === 'sm' ? 'gray.100' : 'white'}
      borderRadius="full"
      p="4"
      display="flex"
      alignItems="center"
      justifyContent="center"
      {...boxProps}
    >
      <UserRound size={iconSize} color={COLORS.brand[500]} strokeWidth={1.5} />
    </Box>
  );
}

interface SpeakerAvatarProps {
  imageUrl?: string | string[];
  name: string;
  size?: 'sm' | 'md' | 'lg';
  onHoverChange?: (isHovering: boolean) => void;
}

const SIZES = {
  sm: {
    avatar: 60,
    icon: 28,
    overlap: 24,
  },
  md: {
    avatar: 70,
    icon: 32,
    overlap: 20,
  },
  lg: {
    avatar: 80,
    icon: 36,
    overlap: 28,
  },
};

export default function SpeakerAvatar({
  imageUrl,
  name,
  size = 'sm',
  onHoverChange,
}: SpeakerAvatarProps): JSX.Element {
  const [isHovering, setIsHovering] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const teamSize = name.includes(',') ? name.split(',').length : 1;
  const hasMultipleImages = Array.isArray(imageUrl) && imageUrl.length > 1;
  const { avatar: avatarSize, icon: iconSize, overlap } = SIZES[size];

  useEffect(() => {
    if (isHovering && hasMultipleImages && Array.isArray(imageUrl)) {
      const imageCount = imageUrl.length;
      const interval = setInterval(() => {
        setActiveImageIndex((prev) => (prev + 1) % imageCount);
      }, 1500);
      return () => clearInterval(interval);
    } else {
      setActiveImageIndex(0);
    }
  }, [isHovering, hasMultipleImages, imageUrl]);

  const handleMouseEnter = () => {
    setIsHovering(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    onHoverChange?.(false);
  };

  // Single image with URL
  if (imageUrl && !Array.isArray(imageUrl)) {
    return (
      <Box
        borderRadius="full"
        overflow="hidden"
        minW={`${avatarSize}px`}
        minH={`${avatarSize}px`}
        maxW={`${avatarSize}px`}
        maxH={`${avatarSize}px`}
        border={size === 'sm' ? '2px' : '3px solid white'}
        borderColor={size === 'sm' ? 'brand.200' : undefined}
        boxShadow={
          size === 'sm'
            ? `0 2px 8px ${brandAlpha(0.15)}`
            : '0 4px 12px rgba(0, 0, 0, 0.15)'
        }
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <Image
          src={imageUrl}
          alt={name}
          w={`${avatarSize}px`}
          h={`${avatarSize}px`}
          objectFit="cover"
        />
      </Box>
    );
  }

  // Multiple images (array)
  if (imageUrl && Array.isArray(imageUrl)) {
    return (
      <Flex
        position="relative"
        minW={`${teamSize * overlap + (avatarSize - overlap)}px`}
        minH={`${avatarSize}px`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Render placeholder icons for missing team members */}
        {Array.from({ length: Math.max(0, teamSize - imageUrl.length) }).map((_, idx) => (
          <PlaceholderCircle
            key={`icon-${idx}`}
            size={size}
            iconSize={iconSize}
            position="absolute"
            left={`${idx * overlap}px`}
            w={`${avatarSize}px`}
            h={`${avatarSize}px`}
            border="3px solid white"
            boxShadow={
              size === 'sm'
                ? '0 2px 8px rgba(0, 0, 0, 0.08)'
                : '0 4px 12px rgba(0, 0, 0, 0.15)'
            }
            zIndex={teamSize - idx}
          />
        ))}

        {/* Render actual images */}
        {imageUrl.map((url, idx) => {
          const offset = Math.max(0, teamSize - imageUrl.length);
          const baseZIndex = teamSize - (offset + idx);
          const isActive = idx === activeImageIndex;
          const zIndex = isHovering && hasMultipleImages ? (isActive ? teamSize + 10 : baseZIndex) : baseZIndex;

          return (
            <Box
              key={`img-${idx}`}
              position="absolute"
              left={`${(offset + idx) * overlap}px`}
              borderRadius="full"
              overflow="hidden"
              w={`${avatarSize}px`}
              h={`${avatarSize}px`}
              border="3px solid white"
              boxShadow={
                isActive && isHovering
                  ? size === 'sm'
                    ? `0 4px 16px ${brandAlpha(0.4)}`
                    : '0 6px 20px rgba(255, 255, 255, 0.5)'
                  : size === 'sm'
                  ? `0 2px 8px ${brandAlpha(0.2)}`
                  : '0 4px 12px rgba(0, 0, 0, 0.15)'
              }
              zIndex={zIndex}
              transition="all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
              transform={isActive && isHovering ? (size === 'sm' ? 'scale(1.1)' : 'scale(1.15)') : 'scale(1)'}
            >
              <Image
                src={url}
                alt={`${name} - ${idx + 1}`}
                w={`${avatarSize}px`}
                h={`${avatarSize}px`}
                objectFit="cover"
              />
            </Box>
          );
        })}
      </Flex>
    );
  }

  // No images - team of multiple people
  if (teamSize > 1) {
    return (
      <Flex
        position="relative"
        minW={`${teamSize * overlap + (avatarSize - overlap)}px`}
        minH={`${avatarSize}px`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {Array.from({ length: teamSize }).map((_, idx) => (
          <PlaceholderCircle
            key={idx}
            size={size}
            iconSize={iconSize}
            position="absolute"
            left={`${idx * overlap}px`}
            w={`${avatarSize}px`}
            h={`${avatarSize}px`}
            border="3px solid white"
            boxShadow={
              size === 'sm'
                ? '0 2px 8px rgba(0, 0, 0, 0.08)'
                : '0 4px 12px rgba(0, 0, 0, 0.15)'
            }
            zIndex={teamSize - idx}
          />
        ))}
      </Flex>
    );
  }

  // No image - single person
  return (
    <PlaceholderCircle
      size={size}
      iconSize={iconSize}
      minW={`${avatarSize}px`}
      minH={`${avatarSize}px`}
      border={size === 'md' ? '3px solid white' : undefined}
      boxShadow={size === 'md' ? '0 4px 12px rgba(0, 0, 0, 0.15)' : undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
}
