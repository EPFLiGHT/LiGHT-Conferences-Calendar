import type { JSX } from 'react';
import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import type { Speaker } from '@/types/speaker';
import SpeakerAvatar from './SpeakerAvatar';
import ModalShell from './ModalShell';
import PresentationDetails from './PresentationDetails';
import SectionRule from './SectionRule';
import { countLabel } from './format';

interface SpeakerModalProps {
  speaker: Speaker;
  onClose: () => void;
}

export default function SpeakerModal({ speaker, onClose }: SpeakerModalProps): JSX.Element {
  const sortedPresentations = [...speaker.presentations].sort((a, b) => b.year - a.year);

  return (
    <ModalShell
      onClose={onClose}
      eyebrow="Speaker Profile"
      title={speaker.name}
      leading={<SpeakerAvatar imageUrl={speaker.imageUrl} name={speaker.name} size="md" />}
      subtitle={
        <Text textStyle="metaLabel" color="brand.400" className="tabular">
          {countLabel(sortedPresentations.length, 'presentation')}
        </Text>
      }
    >
      <SectionRule variant="modal" label="Talks" trailing="Most recent first" mb="6" />

      <VStack gap="0" align="stretch">
        {sortedPresentations.map((presentation, index) => (
          <Flex
            key={`${speaker.id}-presentation-${index}`}
            gap={{ base: '4', md: '8' }}
            py="6"
            borderTop={index === 0 ? 'none' : '1px solid'}
            borderColor="line.default"
            direction={{ base: 'column', md: 'row' }}
          >
            {/* Year gutter */}
            <Box minW={{ md: '100px' }}>
              <Text
                fontSize="32px"
                fontWeight="500"
                color="brand.500"
                letterSpacing="-0.03em"
                lineHeight="1"
                className="tabular"
              >
                {presentation.year}
              </Text>
              <Text textStyle="badgeLabel" color="brand.400" mt="2">
                {presentation.eventType}
                {index === 0 && ' · Latest'}
              </Text>
            </Box>

            <PresentationDetails presentation={presentation} flex="1" />
          </Flex>
        ))}
      </VStack>
    </ModalShell>
  );
}
