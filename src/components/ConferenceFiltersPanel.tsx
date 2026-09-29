import type { JSX } from 'react';
import { Box } from '@chakra-ui/react';
import { RotateCcw } from 'lucide-react';
import PageMasthead from './PageMasthead';
import Search from './Search';
import Filters from './Filters';
import type { Conference } from '@/types/conference';
import { hasActiveConferenceFilters, type ConferenceFiltersState } from '@/hooks/useConferenceFilters';

interface ConferenceFiltersPanelProps {
  title: string;
  description: string;
  eyebrow: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  conferences: Conference[];
  filters: ConferenceFiltersState;
  onFilterChange: (newFilters: Partial<ConferenceFiltersState>) => void;
  onReset: () => void;
}

export default function ConferenceFiltersPanel({
  title,
  description,
  eyebrow,
  searchValue,
  onSearchChange,
  conferences,
  filters,
  onFilterChange,
  onReset,
}: ConferenceFiltersPanelProps): JSX.Element {
  return (
    <Box mb="10">
      <PageMasthead
        eyebrow={eyebrow}
        title={title}
        description={description}
        mb="8"
        trailing={hasActiveConferenceFilters(searchValue, filters) && (
          <Box
            as="button"
            onClick={onReset}
            display="inline-flex"
            alignItems="center"
            justifyContent="center"
            gap="1.5"
            textStyle="badgeLabel"
            color="brand.400"
            cursor="pointer"
            whiteSpace="nowrap"
            ml="auto"
            minH={{ base: '44px', md: 'auto' }}
            py="2"
            px="3"
            my="-2"
            mr="-3"
            borderRadius="badge"
            transition="color 0.18s ease, background 0.18s ease"
            _hover={{ color: 'brand.700' }}
            _active={{ color: 'brand.700', bg: 'brand.50' }}
          >
            <RotateCcw size={12} strokeWidth={1.75} />
            Reset all
          </Box>
        )}
      />

      <Search value={searchValue} onChange={onSearchChange} />

      <Filters
        conferences={conferences}
        filters={filters}
        onFilterChange={onFilterChange}
      />
    </Box>
  );
}
