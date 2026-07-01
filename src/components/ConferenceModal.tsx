import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react';
import { X, Globe, FileText, Code, Calendar } from 'lucide-react';
import DeadlineCard from './DeadlineCard';
import ExternalLinkButton from './ExternalLinkButton';
import ConferenceDetails from './ConferenceDetails';
import ModalShell from './ModalShell';
import SectionLabel from './SectionLabel';
import { getDeadlineInfo } from '@/utils/parser';
import { exportConference } from '@/utils/ics';
import { secondaryButtonStyle } from '@/styles/buttonStyles';
import { Conference } from '@/types/conference';

interface ConferenceModalProps {
  conference: Conference;
  onClose: () => void;
}

export default function ConferenceModal({ conference, onClose }: ConferenceModalProps): JSX.Element | null {
  const deadlines = getDeadlineInfo(conference);

  const handleExport = () => {
    exportConference(conference);
  };

  return (
    <ModalShell onClose={onClose}>
      {(close) => (
        <>
          {/* Header */}
          <Box
            position="sticky"
            top="0"
            bg="white"
            borderBottom="1px solid"
            borderColor="line.strong"
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
              borderColor="line.strong"
              borderRadius="control"
              bg="white"
              color="brand.500"
              cursor="pointer"
              transition="all 0.2s ease"
              _hover={{ bg: 'brand.500', color: 'white', borderColor: 'brand.500' }}
              onClick={close}
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
                <SectionLabel label="Details" trailing="§ 01" />
                <ConferenceDetails conference={conference} variant="modal" />
              </Box>

              {/* Deadlines */}
              {deadlines.length > 0 && (
                <Box>
                  <SectionLabel label="Deadlines" trailing="§ 02" />
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
                <SectionLabel label="Resources" trailing={`§ ${deadlines.length > 0 ? '03' : '02'}`} />
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
        </>
      )}
    </ModalShell>
  );
}
