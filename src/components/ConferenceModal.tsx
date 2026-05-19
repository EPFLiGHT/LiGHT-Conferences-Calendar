import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
  Portal,
} from '@chakra-ui/react';
import { X, Globe, FileText, Code, Calendar } from 'lucide-react';
import DeadlineCard from './DeadlineCard';
import ExternalLinkButton from './ExternalLinkButton';
import ConferenceDetails from './ConferenceDetails';
import { getDeadlineInfo } from '@/utils/parser';
import { exportConference } from '@/utils/ics';
import { secondaryButtonStyle } from '@/styles/buttonStyles';
import { Conference } from '@/types/conference';

interface ConferenceModalProps {
  conference: Conference;
  onClose: () => void;
}

export default function ConferenceModal({ conference, onClose }: ConferenceModalProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(true);
  const deadlines = getDeadlineInfo(conference);

  const handleExport = () => {
    exportConference(conference);
  };

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

  const SectionLabel = ({ children, num }: { children: React.ReactNode; num: string }) => (
    <Flex
      align="baseline"
      justify="space-between"
      pb="3"
      mb="5"
      borderBottom="1px solid"
      borderColor="rgba(46, 95, 168, 0.22)"
    >
      <Text
        fontSize="11px"
        fontWeight="700"
        color="brand.500"
        textTransform="uppercase"
        letterSpacing="0.22em"
      >
        {children}
      </Text>
      <Text
        fontSize="11px"
        fontWeight="600"
        color="brand.400"
        textTransform="uppercase"
        letterSpacing="0.22em"
        className="tabular"
      >
        § {num}
      </Text>
    </Flex>
  );

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
            borderColor="rgba(46, 95, 168, 0.25)"
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
              borderColor="rgba(46, 95, 168, 0.35)"
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
              Conference Dossier
            </Text>
            <VStack align="start" gap="2" pr="12">
              <Heading
                as="h2"
                fontSize={{ base: '2xl', md: '4xl' }}
                fontWeight="600"
                color="brand.500"
                lineHeight="1.05"
                letterSpacing="-0.02em"
              >
                {conference.title}{' '}
                <Text as="span" color="brand.400" fontWeight="500" className="tabular">
                  {conference.year}
                </Text>
              </Heading>
              <Text fontSize="sm" color="gray.600" lineHeight="1.55">
                {conference.full_name}
              </Text>
            </VStack>
          </Box>

          {/* Body */}
          <Box px={{ base: '6', md: '8' }} py={{ base: '6', md: '8' }}>
            <VStack align="stretch" gap="10">
              {/* Conference Details */}
              <Box>
                <SectionLabel num="01">Details</SectionLabel>
                <ConferenceDetails conference={conference} variant="modal" />
              </Box>

              {/* Deadlines */}
              {deadlines.length > 0 && (
                <Box>
                  <SectionLabel num="02">Deadlines</SectionLabel>
                  <VStack align="stretch" gap="4">
                    {deadlines.map((deadline, idx) => (
                      <DeadlineCard
                        key={idx}
                        deadline={deadline}
                        timezone={conference.timezone}
                        variant="detailed"
                      />
                    ))}
                  </VStack>
                </Box>
              )}

              {/* Quick Links */}
              <Box>
                <SectionLabel num={deadlines.length > 0 ? '03' : '02'}>Resources</SectionLabel>
                <Flex gap="3" wrap="wrap">
                  {conference.link && (
                    <ExternalLinkButton href={conference.link} variant="primary" size="md" px="5">
                      <Flex align="center" gap="2">
                        <Globe size={14} strokeWidth={1.75} />
                        <span>Event Website</span>
                      </Flex>
                    </ExternalLinkButton>
                  )}
                  {conference.paperslink && (
                    <ExternalLinkButton href={conference.paperslink} variant="secondary" size="md" px="5">
                      <Flex align="center" gap="2">
                        <FileText size={14} strokeWidth={1.75} />
                        <span>Paper Submission</span>
                      </Flex>
                    </ExternalLinkButton>
                  )}
                  {conference.pwclink && (
                    <ExternalLinkButton href={conference.pwclink} variant="secondary" size="md" px="5">
                      <Flex align="center" gap="2">
                        <Code size={14} strokeWidth={1.75} />
                        <span>Papers with Code</span>
                      </Flex>
                    </ExternalLinkButton>
                  )}
                  <Button
                    onClick={handleExport}
                    size="md"
                    px="5"
                    {...secondaryButtonStyle}
                  >
                    <Flex align="center" gap="2">
                      <Calendar size={14} strokeWidth={1.75} />
                      <span>Export to Calendar</span>
                    </Flex>
                  </Button>
                </Flex>
              </Box>
            </VStack>
          </Box>
        </Box>
      </Box>
    </Portal>
  );
}
