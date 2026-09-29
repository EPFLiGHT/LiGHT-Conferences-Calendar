'use client';

import type { JSX } from 'react';
import { useState, useEffect } from 'react';
import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import { AnimatePresence } from 'framer-motion';
import type { Speaker } from '@/types/speaker';
import AnimatedCard, { MotionBox } from './AnimatedCard';
import PresentationDetails from './PresentationDetails';
import SpeakerAvatar from './SpeakerAvatar';
import { pad2 } from './format';

interface SpeakerCardProps {
  speaker: Speaker;
  index: number;
  onClick: () => void;
}

export default function SpeakerCard({ speaker, index, onClick }: SpeakerCardProps): JSX.Element {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentPresentation = speaker.presentations[currentIndex];
  const total = speaker.presentations.length;
  const hasMultiplePresentations = total > 1;

  useEffect(() => {
    if (!hasMultiplePresentations) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % total);
    }, 5000);
    return () => clearInterval(interval);
  }, [hasMultiplePresentations, total]);

  return (
    <AnimatedCard index={index} onClick={onClick}>
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
            {pad2(currentIndex + 1)} / {pad2(total)}
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
            <PresentationDetails presentation={currentPresentation} />
          </MotionBox>
        </AnimatePresence>
      </Box>
    </AnimatedCard>
  );
}
