import type { JSX } from 'react';
import { Box, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import AnimatedCard from './AnimatedCard';
import DeadlineCard from './DeadlineCard';
import ExternalLinkButton from './ExternalLinkButton';
import SubjectBadge from './SubjectBadge';
import TypeBadge from './TypeBadge';
import NoteBadge from './NoteBadge';
import ConferenceDetails from './ConferenceDetails';
import { getDeadlineInfo, getNoDeadlineLabel } from '@/utils/parser';
import type { Conference } from '@/types/conference';

interface ConferenceCardProps {
  conference: Conference;
  onClick: () => void;
  index: number;
}

export default function ConferenceCard({ conference, onClick, index }: ConferenceCardProps): JSX.Element {
  const allDeadlines = getDeadlineInfo(conference);

  return (
    <AnimatedCard index={index} onClick={onClick}>
      {/* Card Header */}
      <VStack align="stretch" gap="3" mb="3">
        <Flex justify="space-between" align="start" gap="3" wrap="wrap">
          <Heading
            as="h3"
            flex="1"
            minW="200px"
            fontWeight="600"
            fontSize="22px"
            lineHeight="1.2"
            letterSpacing="-0.01em"
            color="brand.500"
          >
            {conference.title}{' '}
            <Text as="span" color="brand.400" fontWeight="500" className="tabular">
              {conference.year}
            </Text>
          </Heading>
          <Flex gap="2" align="center" wrap="wrap" justify="flex-end">
            <TypeBadge type={conference.type} />
            <SubjectBadge
              subjects={conference.sub}
              justify="flex-end"
              align="center"
            />
          </Flex>
        </Flex>
        {conference.note && (
          <NoteBadge note={conference.note} />
        )}
      </VStack>

      {/* Subtitle */}
      <Text fontSize="sm" color="gray.600" mb="5" lineHeight="1.55">
        {conference.full_name}
      </Text>

      {/* Info Section */}
      <Box mb="4">
        <ConferenceDetails conference={conference} />
      </Box>

      {/* Deadlines */}
      {allDeadlines.length > 0 ? (
        <VStack
          align="stretch"
          gap="4"
          py="4"
          px="0"
          borderTop="1px solid"
          borderBottom="1px solid"
          borderColor="line.default"
          mb="4"
        >
          {allDeadlines.map((deadline) => (
            <DeadlineCard key={deadline.kind} deadline={deadline} variant="compact" />
          ))}
        </VStack>
      ) : (
        <Box
          py="3"
          textAlign="center"
          borderTop="1px solid"
          borderBottom="1px solid"
          borderColor="line.default"
          mb="4"
        >
          <Text textStyle="caption" fontWeight="normal" color="gray.500">
            {getNoDeadlineLabel(conference)}
          </Text>
        </Box>
      )}

      {/* Links */}
      <Flex gap="3" wrap="wrap" pt="4">
        {conference.link && (
          <ExternalLinkButton
            href={conference.link}
            variant="primary"
            onClick={(e) => e.stopPropagation()}
          >
            Website
          </ExternalLinkButton>
        )}
        {conference.paperslink && (
          <ExternalLinkButton
            href={conference.paperslink}
            variant="primary"
            onClick={(e) => e.stopPropagation()}
          >
            Papers
          </ExternalLinkButton>
        )}
      </Flex>
    </AnimatedCard>
  );
}
