'use client';

import { useState, useMemo } from 'react';
import { Box, Container, Grid, Button, Flex, Text } from '@chakra-ui/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ConferenceCard from '@/components/ConferenceCard';
import ConferenceModal from '@/components/ConferenceModal';
import ConferenceFiltersPanel from '@/components/ConferenceFiltersPanel';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { useConferences } from '@/hooks/useConferences';
import { useConferenceFilters, type ConferenceFiltersState } from '@/hooks/useConferenceFilters';
import { paginationContainerStyle } from '@/styles/containerStyles';
import { primaryButtonStyle } from '@/styles/buttonStyles';
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
      <Box py={{ base: '6', md: '8' }} pb={{ base: '12', md: '16' }} minH="calc(100vh - 200px)">
        <Container maxW="1200px" px={{ base: '4', md: '6' }} mx="auto">
          <ConferenceFiltersPanel
            title="Research Conferences"
            eyebrow=""
            description="Track upcoming conferences and never miss a deadline. Click on any entry for full details and to export."
            searchValue={searchQuery}
            onSearchChange={setSearchQuery}
            conferences={conferences}
            filters={filters}
            onFilterChange={handleFilterChange}
          />

          <Flex
            align="baseline"
            justify="space-between"
            mb="6"
            pb="3"
            borderBottom="1px solid"
            borderColor="rgba(12, 67, 160, 0.18)"
            gap="4"
            flexWrap="wrap"
          >
            <Text
              fontSize="11px"
              color="brand.400"
              textTransform="uppercase"
              letterSpacing="0.22em"
              fontWeight="600"
              className="tabular"
            >
              Page {String(currentPage).padStart(2, '0')} / {String(totalPages || 1).padStart(2, '0')}
            </Text>
            <Text
              fontSize="11px"
              color="brand.400"
              textTransform="uppercase"
              letterSpacing="0.18em"
              fontWeight="600"
              className="tabular"
            >
              {paginatedConferences.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedConferences.length)} of {filteredAndSortedConferences.length} entries
            </Text>
          </Flex>

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
            <Box mt="12" {...paginationContainerStyle}>
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
        </Container>

        {selectedConference && (
          <ConferenceModal
            conference={selectedConference}
            onClose={() => setSelectedConference(null)}
          />
        )}
      </Box>
      <Footer />
    </>
  );
}
