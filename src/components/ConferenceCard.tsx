import { Box, Flex, Heading, Text, VStack } from '@chakra-ui/react';
import { motion } from 'framer-motion';
import DeadlineCard from './DeadlineCard';
import ExternalLinkButton from './ExternalLinkButton';
import SubjectBadge from './SubjectBadge';
import TypeBadge from './TypeBadge';
import NoteBadge from './NoteBadge';
import ConferenceDetails from './ConferenceDetails';
import { getDeadlineInfo } from '@/utils/parser';
import { Conference } from '@/types/conference';

const MotionBox = motion.create(Box);

interface ConferenceCardProps {
  conference: Conference;
  onClick: () => void;
  index?: number;
}

export default function ConferenceCard({ conference, onClick, index = 0 }: ConferenceCardProps): JSX.Element {
  const allDeadlines = getDeadlineInfo(conference);

  // Label shown when an event carries no deadline, honest about which case applies.
  const noDeadlineLabel =
    conference.deadline_status === 'attendance'
      ? 'Registration only, no submission'
      : conference.deadline_status === 'tba'
        ? 'Deadline to be announced'
        : 'No deadlines on record';

  // Lighter animation for mobile (faster, less "aggressive")
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const animationDelay = isMobile ? (index % 12) * 0.03 : (index % 12) * 0.02;
  const animationDuration = isMobile ? 0.3 : 0.25;

  return (
    <MotionBox
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px", amount: 0.1 }}
      transition={{
        duration: animationDuration,
        delay: animationDelay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      bg="white"
      borderRadius="4px"
      border="1px solid"
      borderColor="rgba(12, 67, 160, 0.22)"
      p="6"
      cursor="pointer"
      position="relative"
      whileHover={{
        borderColor: 'rgba(12, 67, 160, 0.6)',
        transition: { duration: 0.18, ease: 'easeOut' }
      }}
      onClick={onClick}
    >
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
          borderColor="rgba(12, 67, 160, 0.18)"
          mb="4"
        >
          {allDeadlines.map((deadline, idx) => (
            <DeadlineCard
              key={idx}
              deadline={deadline}
              timezone={conference.timezone}
              variant="compact"
            />
          ))}
        </VStack>
      ) : (
        <Box
          py="3"
          textAlign="center"
          borderTop="1px solid"
          borderBottom="1px solid"
          borderColor="rgba(12, 67, 160, 0.18)"
          mb="4"
        >
          <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="0.14em">
            {noDeadlineLabel}
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
        {conference.pwclink && (
          <ExternalLinkButton
            href={conference.pwclink}
            variant="primary"
            onClick={(e) => e.stopPropagation()}
          >
            Papers w/ Code
          </ExternalLinkButton>
        )}
      </Flex>
    </MotionBox>
  );
}
