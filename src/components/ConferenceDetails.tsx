import type { JSX } from 'react';
import { Flex, Grid, Text, VStack } from '@chakra-ui/react';
import { MapPin, Calendar as CalendarIcon } from 'lucide-react';
import SubjectBadge from './SubjectBadge';
import NoteBadge from './NoteBadge';
import type { Conference } from '@/types/conference';

interface ConferenceDetailsProps {
  conference: Conference;
  variant?: 'card' | 'modal';
}

const FIELDS = [
  { key: 'location', Icon: MapPin, label: 'Location', getValue: (conf: Conference) => conf.place || 'TBA' },
  { key: 'date', Icon: CalendarIcon, label: 'Date', getValue: (conf: Conference) => conf.date || 'TBA' },
];

export default function ConferenceDetails({
  conference,
  variant = 'card',
}: ConferenceDetailsProps): JSX.Element {
  if (variant === 'modal') {
    const subjects = conference.sub;
    return (
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="6">
        {FIELDS.map((field) => (
          <VStack key={field.key} align="start" gap="2">
            <Text textStyle="metaLabel" color="brand.400">
              {field.label}
            </Text>
            <Text fontSize="md" color="brand.500" fontWeight="500">
              {field.getValue(conference)}
            </Text>
          </VStack>
        ))}

        {subjects.length > 0 && (
          <VStack align="start" gap="2">
            <Text textStyle="metaLabel" color="brand.400">
              Subject{subjects.length > 1 ? 's' : ''}
            </Text>
            <SubjectBadge subjects={subjects} />
          </VStack>
        )}

        {conference.note && (
          <VStack align="start" gap="2">
            <Text textStyle="metaLabel" color="brand.400">
              Note
            </Text>
            <NoteBadge note={conference.note} layout="modal" />
          </VStack>
        )}
      </Grid>
    );
  }

  return (
    <VStack align="stretch" gap="2">
      {FIELDS.map((field) => (
        <Flex key={field.key} fontSize="sm" align="center">
          <Flex align="center" gap="1.5" color="gray.600" fontWeight="500" minW="100px">
            <field.Icon size={14} />
            <Text>{field.label}:</Text>
          </Flex>
          <Text color="gray.800">{field.getValue(conference)}</Text>
        </Flex>
      ))}
    </VStack>
  );
}
