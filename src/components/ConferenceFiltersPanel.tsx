import { Box, Flex, Heading, Text } from '@chakra-ui/react';
import { RotateCcw } from 'lucide-react';
import Search from './Search';
import Filters from './Filters';
import type { Conference } from '@/types/conference';
import { hasActiveConferenceFilters, type ConferenceFiltersState } from '@/hooks/useConferenceFilters';

interface ConferenceFiltersPanelProps {
  title: string;
  description: string;
  eyebrow?: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  conferences: Conference[];
  filters: ConferenceFiltersState;
  onFilterChange: (newFilters: Partial<ConferenceFiltersState>) => void;
  onReset?: () => void;
}

export default function ConferenceFiltersPanel({
  title,
  description,
  eyebrow = 'LiGHT · Conferences',
  searchValue,
  onSearchChange,
  conferences,
  filters,
  onFilterChange,
  onReset,
}: ConferenceFiltersPanelProps): JSX.Element {
  const showReset = Boolean(onReset) && hasActiveConferenceFilters(searchValue, filters);
  return (
    <Box mb="10">
      {/* Masthead */}
      {eyebrow && (
        <Text textStyle="eyebrow" color="brand.400" mb="4">
          {eyebrow}
        </Text>
      )}

      <Heading
        as="h1"
        fontSize={{ base: '3xl', md: '5xl' }}
        fontWeight="600"
        color="brand.500"
        letterSpacing="-0.022em"
        lineHeight="1.05"
        mb="4"
      >
        {title}
      </Heading>

      <Flex
        align="baseline"
        justify="space-between"
        gap="4"
        flexWrap="wrap"
        pb="4"
        mb="8"
        borderBottom="1px solid"
        borderColor="brand.500"
      >
        <Text fontSize="sm" color="gray.600" maxW="640px" lineHeight="1.55">
          {description}
        </Text>
        {showReset && (
          <Box
            as="button"
            onClick={onReset}
            display="inline-flex"
            alignItems="center"
            gap="1.5"
            textStyle="badgeLabel"
            color="brand.400"
            cursor="pointer"
            whiteSpace="nowrap"
            transition="color 0.18s ease"
            _hover={{ color: 'brand.700' }}
          >
            <RotateCcw size={12} strokeWidth={1.75} />
            Reset all
          </Box>
        )}
      </Flex>

      <Search value={searchValue} onChange={onSearchChange} />

      <Filters
        conferences={conferences}
        filters={filters}
        onFilterChange={onFilterChange}
      />
    </Box>
  );
}
