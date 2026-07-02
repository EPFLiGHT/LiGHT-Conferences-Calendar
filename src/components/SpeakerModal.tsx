'use client';

import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import { Speaker } from '@/types/speaker';
import ExternalLinkButton from './ExternalLinkButton';
import SpeakerAvatar from './SpeakerAvatar';
import ModalShell, { ModalHeader } from './ModalShell';
import SectionLabel from './SectionLabel';

interface SpeakerModalProps {
  speaker: Speaker;
  onClose: () => void;
}

export default function SpeakerModal({ speaker, onClose }: SpeakerModalProps): JSX.Element | null {
  const sortedPresentations = [...speaker.presentations].sort((a, b) => b.year - a.year);
  const total = sortedPresentations.length;

  return (
    <ModalShell onClose={onClose}>
      {(close) => (
        <>
          <ModalHeader eyebrow="Speaker Profile" onClose={close}>
            <Flex align="center" gap="5" pr="12">
              <SpeakerAvatar imageUrl={speaker.imageUrl} name={speaker.name} size="md" />
              <Box>
                <Heading
                  as="h2"
                  fontSize={{ base: '2xl', md: '4xl' }}
                  fontWeight="600"
                  color="brand.500"
                  lineHeight="1.05"
                  letterSpacing="-0.02em"
                  mb="2"
                >
                  {speaker.name}
                </Heading>
                <Text textStyle="metaLabel" color="brand.400" className="tabular">
                  {String(total).padStart(2, '0')} presentation{total === 1 ? '' : 's'}
                </Text>
              </Box>
            </Flex>
          </ModalHeader>

          {/* Body */}
          <Box px={{ base: '6', md: '8' }} py={{ base: '6', md: '8' }}>
            <SectionLabel label="Talks" trailing="Most recent first" mb="6" />

            <VStack gap="0" align="stretch">
              {sortedPresentations.map((presentation, index) => (
                <Flex
                  key={`${speaker.id}-presentation-${index}`}
                  gap={{ base: '4', md: '8' }}
                  py="6"
                  borderTop={index === 0 ? 'none' : '1px solid'}
                  borderColor="line.default"
                  direction={{ base: 'column', md: 'row' }}
                >
                  {/* Year gutter */}
                  <Box minW={{ md: '100px' }}>
                    <Text
                      fontSize="32px"
                      fontWeight="500"
                      color="brand.500"
                      letterSpacing="-0.03em"
                      lineHeight="1"
                      className="tabular"
                    >
                      {presentation.year}
                    </Text>
                    <Text textStyle="badgeLabel" color="brand.400" mt="2">
                      {presentation.eventType}
                      {index === 0 && ' · Latest'}
                    </Text>
                  </Box>

                  {/* Body */}
                  <VStack align="stretch" gap="4" flex="1">
                    <Box>
                      <Text textStyle="fieldLabel" color="brand.400" mb="2">
                        Topic
                      </Text>
                      <Text fontSize="md" color="brand.500" fontWeight="500" lineHeight="1.5" fontStyle="italic">
                        &ldquo;{presentation.topic}&rdquo;
                      </Text>
                    </Box>

                    <Box>
                      <Text textStyle="fieldLabel" color="brand.400" mb="2">
                        Event
                      </Text>
                      <Text fontSize="sm" color="gray.700" lineHeight="1.55">
                        {presentation.event}
                      </Text>
                    </Box>

                    {presentation.link && (
                      <Box>
                        <ExternalLinkButton
                          href={presentation.link}
                          variant="secondary"
                          size="sm"
                        >
                          <Flex align="center" gap="2">
                            <ExternalLink size={13} strokeWidth={1.75} />
                            <Text>View Presentation</Text>
                          </Flex>
                        </ExternalLinkButton>
                      </Box>
                    )}
                  </VStack>
                </Flex>
              ))}
            </VStack>
          </Box>
        </>
      )}
    </ModalShell>
  );
}
