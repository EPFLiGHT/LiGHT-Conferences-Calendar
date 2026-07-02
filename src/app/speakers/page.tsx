'use client';

import { useState, useEffect } from 'react';
import { Box, Flex, Grid, Heading, Text } from '@chakra-ui/react';
import yaml from 'js-yaml';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageShell from '@/components/PageShell';
import SpeakerCard from '@/components/SpeakerCard';
import SpeakerModal from '@/components/SpeakerModal';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { Speaker } from '@/types/speaker';

export default function SpeakersPage() {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

  useEffect(() => {
    const fetchSpeakers = async () => {
      try {
        const response = await fetch('/data/speakers.yaml');
        if (!response.ok) {
          throw new Error('Failed to fetch speakers data');
        }
        const yamlText = await response.text();
        const data = yaml.load(yamlText) as Speaker[];
        setSpeakers(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchSpeakers();
  }, []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <>
      <Header />
      <PageShell>
          {/* Page Header */}
          <Box mb="10">
            <Text textStyle="eyebrow" color="brand.400" mb="4">
              LiGHT · Speakers
            </Text>

            <Heading
              as="h1"
              fontSize={{ base: '3xl', md: '5xl' }}
              fontWeight="600"
              color="brand.500"
              letterSpacing="-0.022em"
              lineHeight="1.05"
              mb="4"
            >
              Our Speakers
            </Heading>

            <Flex
              align="baseline"
              justify="space-between"
              gap="4"
              flexWrap="wrap"
              pb="4"
              borderBottom="1px solid"
              borderColor="brand.500"
            >
              <Text fontSize="sm" color="gray.600" maxW="640px" lineHeight="1.55">
                Members of LiGHT Lab who have presented their research at conferences, workshops, summits, and seminars around the world.
              </Text>
              <Text
                textStyle="metaLabel"
                color="brand.400"
                className="tabular"
                whiteSpace="nowrap"
              >
                {String(speakers.length).padStart(2, '0')} member{speakers.length === 1 ? '' : 's'}
              </Text>
            </Flex>
          </Box>

          {/* Speakers Grid */}
          <Grid
            templateColumns={{
              base: '1fr',
              sm: 'repeat(auto-fill, minmax(320px, 1fr))',
              lg: 'repeat(auto-fill, minmax(360px, 1fr))',
            }}
            gap="6"
            mb="8"
          >
            {speakers.map((speaker, index) => (
              <SpeakerCard
                key={speaker.id}
                speaker={speaker}
                index={index}
                onClick={() => setSelectedSpeaker(speaker)}
              />
            ))}
          </Grid>

          {/* Empty State */}
          {speakers.length === 0 && (
            <Box
              textAlign="center"
              py="12"
              color="gray.500"
            >
              <Text fontSize="lg">
                No speakers found.
              </Text>
            </Box>
          )}
      </PageShell>
      <Footer />

      {/* Speaker Modal */}
      {selectedSpeaker && (
        <SpeakerModal
          speaker={selectedSpeaker}
          onClose={() => setSelectedSpeaker(null)}
        />
      )}
    </>
  );
}
