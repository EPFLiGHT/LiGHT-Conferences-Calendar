'use client';

import { useState } from 'react';
import { Box, Grid, Text } from '@chakra-ui/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageShell from '@/components/PageShell';
import PageMasthead from '@/components/PageMasthead';
import SpeakerCard from '@/components/SpeakerCard';
import SpeakerModal from '@/components/SpeakerModal';
import { LoadingState, ErrorState } from '@/components/StatusScreen';
import { countLabel } from '@/components/format';
import { useSpeakers } from '@/hooks/useSpeakers';
import type { Speaker } from '@/types/speaker';

export default function SpeakersPage() {
  const { speakers, loading, error } = useSpeakers();
  const [selectedSpeaker, setSelectedSpeaker] = useState<Speaker | null>(null);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <>
      <Header />
      <PageShell>
          <PageMasthead
            eyebrow="LiGHT · Speakers"
            title="Our Speakers"
            description="Members of LiGHT Lab who have presented their research at conferences, workshops, summits, and seminars around the world."
            trailing={
              <Text
                textStyle="metaLabel"
                color="brand.400"
                className="tabular"
                whiteSpace="nowrap"
              >
                {countLabel(speakers.length, 'member')}
              </Text>
            }
          />

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

      {selectedSpeaker && (
        <SpeakerModal
          speaker={selectedSpeaker}
          onClose={() => setSelectedSpeaker(null)}
        />
      )}
    </>
  );
}
