'use client';

import { Suspense, useState } from 'react';
import { Box, Grid, Button, Flex, Text, type ButtonProps } from '@chakra-ui/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageShell from '@/components/PageShell';
import ConferenceCard from '@/components/ConferenceCard';
import ConferenceModal from '@/components/ConferenceModal';
import ConferenceFiltersPanel from '@/components/ConferenceFiltersPanel';
import SectionRule from '@/components/SectionRule';
import { LoadingState, ErrorState } from '@/components/StatusScreen';
import { pad2 } from '@/components/format';
import { useConferences } from '@/hooks/useConferences';
import { useConferenceFilters, hasActiveConferenceFilters } from '@/hooks/useConferenceFilters';
import { useConferenceFilterState } from '@/hooks/useConferenceFilterState';
import { cardSurfaceStyle } from '@/styles/containerStyles';
import { primaryButtonStyle, secondaryButtonStyle } from '@/styles/buttonStyles';
import type { Conference } from '@/types/conference';

const ITEMS_PER_PAGE = 12;

function PageButton({ label, shortLabel, ...props }: ButtonProps & { label: string; shortLabel: string }) {
  return (
    <Button
      size={{ base: 'sm', md: 'md' }}
      px={{ base: '4', md: '6' }}
      minW={{ sm: '32' }}
      {...primaryButtonStyle}
      {...props}
    >
      <Text display={{ base: 'none', sm: 'inline' }}>{label}</Text>
      <Text display={{ base: 'inline', sm: 'none' }}>{shortLabel}</Text>
    </Button>
  );
}

function HomeContent() {
  const { conferences, loading, error } = useConferences();
  const [selectedConference, setSelectedConference] = useState<Conference | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { searchQuery, filters, setSearchQuery, updateFilters, resetFilters } =
    useConferenceFilterState(() => setCurrentPage(1));

  const filteredAndSortedConferences = useConferenceFilters(conferences, searchQuery, filters);

  const pageStart = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedConferences = filteredAndSortedConferences.slice(pageStart, pageStart + ITEMS_PER_PAGE);
  const totalPages = Math.ceil(filteredAndSortedConferences.length / ITEMS_PER_PAGE);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(totalPages, Math.max(1, page)));
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0);
  };

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <>
      <Header />
      <PageShell>
          <ConferenceFiltersPanel
            title="Conferences & Events"
            eyebrow="LiGHT · Index"
            description="Discover conferences and events in global health, humanitarian response and AI, and track their key dates and submission deadlines. Click any entry for full details and to export."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            conferences={conferences}
            filters={filters}
            onFilterChange={updateFilters}
            onReset={resetFilters}
          />

          <SectionRule
            labelColor="brand.400"
            label={`Page ${pad2(currentPage)} / ${pad2(totalPages || 1)}`}
            trailing={`${paginatedConferences.length > 0 ? pageStart + 1 : 0}–${Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedConferences.length)} of ${filteredAndSortedConferences.length} entries`}
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
                    onClick={resetFilters}
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
                <PageButton
                  label="← Previous"
                  shortLabel="←"
                  disabled={currentPage === 1}
                  onClick={() => goToPage(currentPage - 1)}
                />

                <Flex
                  align="center"
                  h={{ base: '9', md: '10' }}
                  px={{ base: '4', md: '6' }}
                  bg="brand.50"
                  borderRadius="control"
                  border="1px solid"
                  borderColor="brand.200"
                >
                  <Text fontSize={{ base: 'xs', md: 'sm' }} color="brand.600" fontWeight="600" className="tabular">
                    Page {currentPage} of {totalPages}
                  </Text>
                </Flex>

                <PageButton
                  label="Next →"
                  shortLabel="→"
                  disabled={currentPage === totalPages}
                  onClick={() => goToPage(currentPage + 1)}
                />
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

export default function Page() {
  return (
    <Suspense fallback={<LoadingState />}>
      <HomeContent />
    </Suspense>
  );
}
