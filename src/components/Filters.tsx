import { forwardRef, useMemo } from 'react';
import { Box, Flex, Grid, Text } from '@chakra-ui/react';
import { NativeSelectRoot, NativeSelectField } from '@chakra-ui/react';
import InfoTooltip from './InfoTooltip';
import { Conference } from '@/types/conference';
import { getSubjectsArray } from '@/utils/parser';
import { SUBJECT_LABELS } from '@/constants/subjects';
import { VALID_TYPES } from '@/utils/conferenceSchema';
import type { ConferenceFiltersState } from '@/hooks/useConferenceFilters';

interface FiltersProps {
  conferences: Conference[];
  filters: ConferenceFiltersState;
  onFilterChange: (newFilters: Partial<ConferenceFiltersState>) => void;
}

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  label: string;
  cursor?: string;
}

const Chip = forwardRef<HTMLButtonElement, ChipProps>(
  function Chip({ selected, onClick, label, cursor = 'pointer', ...rest }, ref) {
    return (
      <Box
        ref={ref}
        as="button"
        onClick={onClick}
        px="3"
        py="1.5"
        textStyle="badgeLabel"
        borderRadius="badge"
        border="1px solid"
        bg={selected ? 'brand.500' : 'white'}
        color={selected ? 'white' : 'brand.500'}
        borderColor={selected ? 'brand.500' : 'line.strong'}
        cursor={cursor}
        transition="all 0.18s ease"
        whiteSpace="nowrap"
        lineHeight="1"
        _hover={{
          borderColor: 'brand.500',
          bg: selected ? 'brand.700' : 'brand.50',
        }}
        {...rest}
      >
        {label}
      </Box>
    );
  }
);

interface FilterGroupProps {
  label: string;
  selectedLabel: string;
  children: React.ReactNode;
}

function FilterGroup({ label, selectedLabel, children }: FilterGroupProps): JSX.Element {
  return (
    <Box>
      <Flex
        align="baseline"
        justify="space-between"
        pb="2"
        mb="3"
        borderBottom="1px solid"
        borderColor="line.default"
        gap="3"
        flexWrap="wrap"
      >
        <Text textStyle="badgeLabel" color="brand.500">
          {label}
        </Text>
        <Text textStyle="fieldLabel" color="brand.400">
          {selectedLabel}
        </Text>
      </Flex>
      {children}
    </Box>
  );
}

export default function Filters({ conferences, filters, onFilterChange }: FiltersProps): JSX.Element {
  const years = useMemo(() => {
    const uniqueYears = [...new Set(conferences.map(c => c.year))].sort((a, b) => b - a);
    return uniqueYears;
  }, [conferences]);

  const subjects = useMemo(() => {
    const subjectSet = new Set<string>();
    conferences.forEach(conference => {
      getSubjectsArray(conference.sub).forEach(subject => subjectSet.add(subject));
    });
    return [...subjectSet].sort();
  }, [conferences]);

  const types = VALID_TYPES;

  const sortLabel =
    filters.sortBy === 'deadline' ? 'Upcoming Deadline' :
    filters.sortBy === 'hindex' ? 'H-Index' :
    'Start Date';

  const selectStyle = {
    fontSize: 'sm',
    color: 'brand.500',
    borderColor: 'line.strong',
    borderRadius: 'badge',
    fontWeight: '500',
    _focus: {
      borderColor: 'brand.500',
      boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)',
    },
  } as const;

  return (
    <Flex direction="column" gap="8">
      {/* Sort + Year row */}
      <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="6">
        <FilterGroup label="Sort by" selectedLabel={sortLabel}>
          <NativeSelectRoot>
            <NativeSelectField
              value={filters.sortBy}
              onChange={(e) => onFilterChange({ sortBy: e.target.value })}
              {...selectStyle}
            >
              <option value="deadline">Upcoming Deadline</option>
              <option value="hindex">H-Index</option>
              <option value="start">Start Date</option>
            </NativeSelectField>
          </NativeSelectRoot>
        </FilterGroup>

        <FilterGroup label="Year" selectedLabel={filters.year || 'All years'}>
          <NativeSelectRoot>
            <NativeSelectField
              value={filters.year}
              onChange={(e) => onFilterChange({ year: e.target.value })}
              {...selectStyle}
            >
              <option value="">All Years</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </FilterGroup>
      </Grid>

      {/* Type */}
      <FilterGroup
        label="Type"
        selectedLabel={filters.type.length === 0 ? 'All' : `${filters.type.length} selected`}
      >
        <Flex gap="2" wrap="wrap">
          <Chip
            label="All"
            selected={filters.type.length === 0}
            onClick={() => onFilterChange({ type: [] })}
          />
          {types.map(type => {
            const isSelected = filters.type.includes(type);
            return (
              <Chip
                key={type}
                label={type}
                selected={isSelected}
                onClick={() => {
                  const newTypes = isSelected
                    ? filters.type.filter(t => t !== type)
                    : [...filters.type, type];
                  onFilterChange({ type: newTypes });
                }}
              />
            );
          })}
        </Flex>
      </FilterGroup>

      {/* Subject */}
      <FilterGroup
        label="Subject"
        selectedLabel={filters.subject.length === 0 ? 'All' : `${filters.subject.length} selected`}
      >
        <Flex gap="2" wrap="wrap">
          <Chip
            label="All"
            selected={filters.subject.length === 0}
            onClick={() => onFilterChange({ subject: [] })}
          />
          {subjects.map(subject => {
            const isSelected = filters.subject.includes(subject);
            return (
              <InfoTooltip key={subject} label={SUBJECT_LABELS[subject] || subject}>
                <Chip
                  label={subject}
                  selected={isSelected}
                  cursor="help"
                  onClick={() => {
                    const newSubjects = isSelected
                      ? filters.subject.filter(s => s !== subject)
                      : [...filters.subject, subject];
                    onFilterChange({ subject: newSubjects });
                  }}
                />
              </InfoTooltip>
            );
          })}
        </Flex>
      </FilterGroup>
    </Flex>
  );
}
