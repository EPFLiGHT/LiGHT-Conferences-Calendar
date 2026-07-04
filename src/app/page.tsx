'use client';

import { useState, useMemo } from 'react';
import { Box, Grid, Button, Flex, Text } from '@chakra-ui/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageShell from '@/components/PageShell';
import ConferenceCard from '@/components/ConferenceCard';
import ConferenceModal from '@/components/ConferenceModal';
import ConferenceFiltersPanel from '@/components/ConferenceFiltersPanel';
import SectionRule from '@/components/SectionRule';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { useConferences } from '@/hooks/useConferences';
import {
  useConferenceFilters,
  hasActiveConferenceFilters,
  type ConferenceFiltersState,
} from '@/hooks/useConferenceFilters';
import { cardSurfaceStyle } from '@/styles/containerStyles';
import { primaryButtonStyle, secondaryButtonStyle } from '@/styles/buttonStyles';
import type { Conference } from '@/types/conference';

const ITEMS_PER_PAGE = 12;

export default function Page() {
  const { conferences, loading, error } = useConferences();
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<ConferenceFiltersState>({
    sortBy: 'deadline',
    year: '',
    subject: [],
    type: [],
  });

  const scrollToTop = () => {
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 0);
  };

  const handleFilterChange = (newFilters: Partial<ConferenceFiltersState>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleResetAll = () => {
    setSearchQuery('');
    setFilters(prev => ({ ...prev, year: '', subject: [], type: [] }));
    setCurrentPage(1);
  };

  const filteredAndSortedConferences = useConferenceFilters(conferences, searchQuery, filters);

  const paginatedConferences = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedConferences.slice(startIndex, endIndex);
  }, [filteredAndSortedConferences, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedConferences.length / ITEMS_PER_PAGE);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <>
      <Header />
      <PageShell>
          <ConferenceFiltersPanel
            title="Research Conferences"
            eyebrow="LiGHT · Index"
            description="Track upcoming conferences and never miss a deadline. Click on any entry for full details and to export."
            searchValue={searchQuery}
            onSearchChange={handleSearchChange}
            conferences={conferences}
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetAll}
          />

          <SectionRule
            labelColor="brand.400"
            label={`Page ${String(currentPage).padStart(2, '0')} / ${String(totalPages || 1).padStart(2, '0')}`}
            trailing={`${paginatedConferences.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}–${Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedConferences.length)} of ${filteredAndSortedConferences.length} entries`}
          />

          <Grid
            templateColumns={{ base: '1fr', md: 'repeat(auto-fill, minmax(350px, 1fr))' }}
            gap={{ base: '4', md: '6' }}
            mb="8"
          >
            {paginatedConferences.length === 0 ? (
              <Box gridColumn="1 / -1" textAlign="center" py="16" px="8">
                <Text fontSize="lg" color="gray.500">
                  No conferences found matching your criteria.
                </Text>
                {hasActiveConferenceFilters(searchQuery, filters) && (
                  <Button
                    onClick={handleResetAll}
                    mt="5"
                    size="sm"
                    px="5"
                    {...secondaryButtonStyle}
                  >
                    Reset all
                  </Button>
                )}
              </Box>
            ) : (
              paginatedConferences.map((conference, index) => (
                <ConferenceCard
                  key={conference.id}
                  conference={conference}
                  onClick={() => setSelectedConference(conference)}
                  index={index}
                />
              ))
            )}
          </Grid>

          {totalPages > 1 && (
            <Box mt="12" {...cardSurfaceStyle}>
              <Flex
                justify="center"
                align="center"
                gap={{ base: '2', md: '4' }}
                flexWrap="wrap"
              >
                <Button
                  onClick={() => {
                    setCurrentPage(prev => Math.max(1, prev - 1));
                    scrollToTop();
                  }}
                  disabled={currentPage === 1}
                  size={{ base: 'sm', md: 'md' }}
                  px={{ base: '4', md: '6' }}
                  {...primaryButtonStyle}
                >
                  <Text display={{ base: 'none', sm: 'inline' }}>← Previous</Text>
                  <Text display={{ base: 'inline', sm: 'none' }}>←</Text>
                </Button>

                <Box
                  px={{ base: '4', md: '6' }}
                  py="2"
                  bg="brand.50"
                  borderRadius="lg"
                  border="1px"
                  borderColor="brand.200"
                >
                  <Text fontSize={{ base: 'xs', md: 'sm' }} color="brand.600" fontWeight="600">
                    Page {currentPage} of {totalPages}
                  </Text>
                </Box>

                <Button
                  onClick={() => {
                    setCurrentPage(prev => Math.min(totalPages, prev + 1));
                    scrollToTop();
                  }}
                  disabled={currentPage === totalPages}
                  size={{ base: 'sm', md: 'md' }}
                  px={{ base: '4', md: '6' }}
                  {...primaryButtonStyle}
                >
                  <Text display={{ base: 'none', sm: 'inline' }}>Next →</Text>
                  <Text display={{ base: 'inline', sm: 'none' }}>→</Text>
                </Button>
              </Flex>
            </Box>
          )}
      </PageShell>

      {selectedConference && (
        <ConferenceModal
          conference={selectedConference}
          onClose={() => setSelectedConference(null)}
        />
      )}
      <Footer />
    </>
  );
}
