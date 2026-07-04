import type { JSX } from 'react';
import { Flex, Grid, Text, VStack } from '@chakra-ui/react';
import { MapPin, Calendar as CalendarIcon, BarChart3, type LucideIcon } from 'lucide-react';
import SubjectBadge from './SubjectBadge';
import NoteBadge from './NoteBadge';
import type { Conference } from '@/types/conference';
import { getSubjectsArray } from '@/utils/parser';

interface ConferenceDetailsProps {
  conference: Conference;
  variant?: 'card' | 'modal';
  showSubjects?: boolean;
  showNote?: boolean;
}

const CARD_FIELDS: Array<{
  key: string;
  Icon: LucideIcon;
  label: string;
  getValue: (conference: Conference) => string | number;
}> = [
  {
    key: 'location',
    Icon: MapPin,
    label: 'Location:',
    getValue: (conf) => conf.place || 'TBA',
  },
  {
    key: 'date',
    Icon: CalendarIcon,
    label: 'Date:',
    getValue: (conf) => conf.date || 'TBA',
  },
  {
    key: 'hindex',
    Icon: BarChart3,
    label: 'H-Index:',
    getValue: (conf) => conf.hindex ?? 0,
  },
];

const MODAL_FIELDS: Array<{
  key: string;
  label: string;
  getValue: (conference: Conference) => string | number;
  isPresent: (conference: Conference) => boolean;
}> = [
  {
    key: 'location',
    label: 'Location',
    getValue: (conf) => conf.place || 'TBA',
    isPresent: () => true,
  },
  {
    key: 'date',
    label: 'Date',
    getValue: (conf) => conf.date || 'TBA',
    isPresent: () => true,
  },
  {
    key: 'hindex',
    label: 'H-Index',
    getValue: (conf) => conf.hindex ?? 0,
    isPresent: (conf) => (conf.hindex ?? 0) > 0,
  },
];

export default function ConferenceDetails({
  conference,
  variant = 'card',
  showSubjects = variant === 'modal',
  showNote = variant === 'modal',
}: ConferenceDetailsProps): JSX.Element {
  const subjects = getSubjectsArray(conference.sub);

  if (variant === 'modal') {
    return (
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="6">
        {MODAL_FIELDS.filter((field) => field.isPresent(conference)).map((field) => (
          <VStack key={field.key} align="start" gap="2">
            <Text textStyle="metaLabel" color="brand.400">
              {field.label}
            </Text>
            <Text fontSize="md" color="brand.500" fontWeight="500" className={field.key === 'hindex' ? 'tabular' : undefined}>
              {field.getValue(conference)}
            </Text>
          </VStack>
        ))}

        {showSubjects && subjects.length > 0 && (
          <VStack align="start" gap="2">
            <Text textStyle="metaLabel" color="brand.400">
              Subject{subjects.length > 1 ? 's' : ''}
            </Text>
            <SubjectBadge subjects={subjects} />
          </VStack>
        )}

        {showNote && conference.note && (
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
      {CARD_FIELDS.map((field) => {
        if (field.key === 'hindex' && (conference.hindex ?? 0) <= 0) {
          return null;
        }

        return (
          <Flex key={field.key} fontSize="sm" align="center">
            <Flex align="center" gap="1.5" color="gray.600" fontWeight="500" minW="100px">
              <field.Icon size={14} />
              <Text>{field.label}</Text>
            </Flex>
            <Text color="gray.800">{field.getValue(conference)}</Text>
          </Flex>
        );
      })}

      {showNote && conference.note && <NoteBadge note={conference.note} />}
    </VStack>
  );
}
