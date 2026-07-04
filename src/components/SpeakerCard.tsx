'use client';

import type { JSX } from 'react';
import { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { Speaker } from '@/types/speaker';
import ExternalLinkButton from './ExternalLinkButton';
import SpeakerAvatar from './SpeakerAvatar';
import { cardSurfaceStyle } from '@/styles/containerStyles';
import { useCardAnimation } from '@/hooks/useCardAnimation';
import { brandAlpha } from '@/theme';

const MotionBox = motion.create(Box);

interface SpeakerCardProps {
  speaker: Speaker;
  index?: number;
  onClick?: () => void;
}

export default function SpeakerCard({ speaker, index = 0, onClick }: SpeakerCardProps): JSX.Element {
  const { animationDelay, animationDuration } = useCardAnimation(index);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentPresentation = speaker.presentations[currentIndex];
  const hasMultiplePresentations = speaker.presentations.length > 1;

  useEffect(() => {
    if (!hasMultiplePresentations) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) =>
        prev === speaker.presentations.length - 1 ? 0 : prev + 1
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [hasMultiplePresentations, speaker.presentations.length]);

  const total = speaker.presentations.length;

  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px', amount: 0.1 }}
      transition={{
        duration: animationDuration,
        delay: animationDelay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      {...cardSurfaceStyle}
      cursor={onClick ? 'pointer' : 'default'}
      onClick={onClick}
      whileHover={{
        borderColor: brandAlpha(0.55),
        transition: { duration: 0.18, ease: 'easeOut' },
      }}
    >
      {/* Header: avatar + name + counter */}
      <Flex align="center" justify="space-between" mb="5" gap="4">
        <Flex align="center" gap="4" flex="1" minW="0">
          <SpeakerAvatar imageUrl={speaker.imageUrl} name={speaker.name} size="sm" />
          <Heading
            fontSize="lg"
            fontWeight="600"
            color="brand.500"
            lineHeight="1.2"
            letterSpacing="-0.005em"
          >
            {speaker.name}
          </Heading>
        </Flex>
        {hasMultiplePresentations && (
          <Text
            textStyle="badgeLabel"
            color="brand.400"
            className="tabular"
            whiteSpace="nowrap"
          >
            {String(currentIndex + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </Text>
        )}
      </Flex>

      {/* Top hairline rule */}
      <Box borderTop="1px solid" borderColor="line.default" mb="5" />

      {/* Type tag */}
      <Text textStyle="badgeLabel" color="brand.500" mb="4">
        {currentPresentation.eventType}
      </Text>

      {/* Carousel */}
      <Box position="relative" minH="160px">
        <AnimatePresence mode="wait">
          <MotionBox
            key={currentIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
          >
            <VStack align="stretch" gap="4">
              {/* Topic */}
              <Box>
                <Text textStyle="fieldLabel" color="brand.400" mb="2">
                  Topic
                </Text>
                <Text fontSize="md" color="brand.500" fontWeight="500" lineHeight="1.45" fontStyle="italic">
                  &ldquo;{currentPresentation.topic}&rdquo;
                </Text>
              </Box>

              {/* Event */}
              <Box>
                <Text textStyle="fieldLabel" color="brand.400" mb="2">
                  Event
                </Text>
                <Text fontSize="sm" color="gray.700" lineHeight="1.5">
                  {currentPresentation.event}
                </Text>
              </Box>

              {/* Link */}
              {currentPresentation.link && (
                <Box pt="2">
                  <ExternalLinkButton
                    href={currentPresentation.link}
                    variant="secondary"
                    size="sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Flex align="center" gap="2">
                      <ExternalLink size={13} strokeWidth={1.75} />
                      <Text>View Presentation</Text>
                    </Flex>
                  </ExternalLinkButton>
                </Box>
              )}
            </VStack>
          </MotionBox>
        </AnimatePresence>
      </Box>
    </MotionBox>
  );
}
