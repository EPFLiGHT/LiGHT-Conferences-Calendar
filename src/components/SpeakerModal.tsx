'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Heading,
  Text,
  VStack,
  Portal,
} from '@chakra-ui/react';
import { X, ExternalLink } from 'lucide-react';
import { Speaker } from '@/types/speaker';
import ExternalLinkButton from './ExternalLinkButton';
import SpeakerAvatar from './SpeakerAvatar';

interface SpeakerModalProps {
  speaker: Speaker;
  onClose: () => void;
}

export default function SpeakerModal({ speaker, onClose }: SpeakerModalProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(true);

  const sortedPresentations = [...speaker.presentations].sort((a, b) => b.year - a.year);

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleEscapeKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, []);

  if (!isOpen) return null;

  const total = sortedPresentations.length;

  return (
    <Portal>
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="rgba(10, 26, 61, 0.45)"
        backdropFilter="blur(2px)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex="modal"
        p={{ base: '3', md: '6' }}
        onClick={handleBackdropClick}
      >
        <Box
          bg="white"
          borderRadius="4px"
          maxW="860px"
          w="full"
          maxH="90vh"
          overflowY="auto"
          border="1px solid"
          borderColor="brand.500"
          position="relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top accent rule */}
          <Box h="3px" bg="brand.500" />

          {/* Header */}
          <Box
            position="sticky"
            top="0"
            bg="white"
            borderBottom="1px solid"
            borderColor="rgba(12, 67, 160, 0.25)"
            px={{ base: '6', md: '8' }}
            py={{ base: '5', md: '6' }}
            zIndex="10"
          >
            <Box
              as="button"
              position="absolute"
              top="5"
              right="5"
              w="32px"
              h="32px"
              display="flex"
              alignItems="center"
              justifyContent="center"
              border="1px solid"
              borderColor="rgba(12, 67, 160, 0.35)"
              borderRadius="3px"
              bg="white"
              color="brand.500"
              cursor="pointer"
              transition="all 0.2s ease"
              _hover={{ bg: 'brand.500', color: 'white', borderColor: 'brand.500' }}
              onClick={handleClose}
              aria-label="Close"
            >
              <X size={16} strokeWidth={2} />
            </Box>

            <Text
              fontSize="11px"
              color="brand.400"
              textTransform="uppercase"
              letterSpacing="0.22em"
              fontWeight="700"
              mb="3"
            >
              Speaker Profile
            </Text>

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
                <Text
                  fontSize="11px"
                  color="brand.400"
                  textTransform="uppercase"
                  letterSpacing="0.22em"
                  fontWeight="600"
                  className="tabular"
                >
                  {String(total).padStart(2, '0')} presentation{total === 1 ? '' : 's'}
                </Text>
              </Box>
            </Flex>
          </Box>

          {/* Body */}
          <Box px={{ base: '6', md: '8' }} py={{ base: '6', md: '8' }}>
            <Flex
              align="baseline"
              justify="space-between"
              pb="3"
              mb="6"
              borderBottom="1px solid"
              borderColor="rgba(12, 67, 160, 0.22)"
            >
              <Text
                fontSize="11px"
                fontWeight="700"
                color="brand.500"
                textTransform="uppercase"
                letterSpacing="0.22em"
              >
                Talks
              </Text>
              <Text
                fontSize="11px"
                fontWeight="600"
                color="brand.400"
                textTransform="uppercase"
                letterSpacing="0.22em"
                className="tabular"
              >
                Most recent first
              </Text>
            </Flex>

            <VStack gap="0" align="stretch">
              {sortedPresentations.map((presentation, index) => (
                <Flex
                  key={`${speaker.id}-presentation-${index}`}
                  gap={{ base: '4', md: '8' }}
                  py="6"
                  borderTop={index === 0 ? 'none' : '1px solid'}
                  borderColor="rgba(12, 67, 160, 0.18)"
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
                    <Text
                      fontSize="10px"
                      fontWeight="700"
                      color="brand.400"
                      textTransform="uppercase"
                      letterSpacing="0.2em"
                      mt="2"
                    >
                      {presentation.eventType}
                      {index === 0 && ' · Latest'}
                    </Text>
                  </Box>

                  {/* Body */}
                  <VStack align="stretch" gap="4" flex="1">
                    <Box>
                      <Text
                        fontSize="10px"
                        fontWeight="600"
                        color="brand.400"
                        textTransform="uppercase"
                        letterSpacing="0.2em"
                        mb="2"
                      >
                        Topic
                      </Text>
                      <Text fontSize="md" color="brand.500" fontWeight="500" lineHeight="1.5" fontStyle="italic">
                        &ldquo;{presentation.topic}&rdquo;
                      </Text>
                    </Box>

                    <Box>
                      <Text
                        fontSize="10px"
                        fontWeight="600"
                        color="brand.400"
                        textTransform="uppercase"
                        letterSpacing="0.2em"
                        mb="2"
                      >
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
        </Box>
      </Box>
    </Portal>
  );
}
