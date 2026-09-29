import type { JSX } from 'react';
import { Box, Button, Flex, Text, VStack } from '@chakra-ui/react';
import { Globe, FileText, Calendar } from 'lucide-react';
import DeadlineCard from './DeadlineCard';
import ExternalLinkButton from './ExternalLinkButton';
import ConferenceDetails from './ConferenceDetails';
import ModalShell from './ModalShell';
import SectionRule from './SectionRule';
import { getDeadlineInfo } from '@/utils/parser';
import { exportConference } from '@/utils/ics';
import { secondaryButtonStyle } from '@/styles/buttonStyles';
import type { Conference } from '@/types/conference';

interface ConferenceModalProps {
  conference: Conference;
  onClose: () => void;
}

export default function ConferenceModal({ conference, onClose }: ConferenceModalProps): JSX.Element {
  const deadlines = getDeadlineInfo(conference);

  return (
    <ModalShell
      onClose={onClose}
      eyebrow="Conference Dossier"
      title={
        <>
          {conference.title}{' '}
          <Text as="span" color="brand.400" fontWeight="500" className="tabular">
            {conference.year}
          </Text>
        </>
      }
      subtitle={
        <Text fontSize="sm" color="gray.600" lineHeight="1.55">
          {conference.full_name}
        </Text>
      }
    >
      <VStack align="stretch" gap="10">
        {/* Conference Details */}
        <Box>
          <SectionRule variant="modal" label="Details" trailing="§ 01" />
          <ConferenceDetails conference={conference} variant="modal" />
        </Box>

        {/* Deadlines */}
        {deadlines.length > 0 && (
          <Box>
            <SectionRule variant="modal" label="Deadlines" trailing="§ 02" />
            <VStack align="stretch" gap="4">
              {deadlines.map((deadline) => (
                <DeadlineCard key={deadline.kind} deadline={deadline} variant="detailed" />
              ))}
            </VStack>
          </Box>
        )}

        {/* Quick Links */}
        <Box>
          <SectionRule variant="modal" label="Resources" trailing={`§ ${deadlines.length > 0 ? '03' : '02'}`} />
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
            <Button
              onClick={() => exportConference(conference)}
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
    </ModalShell>
  );
}
