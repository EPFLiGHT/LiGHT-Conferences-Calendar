import type { JSX } from 'react';
import { Box, Flex, Text, VStack, type StackProps } from '@chakra-ui/react';
import { ExternalLink } from 'lucide-react';
import ExternalLinkButton from './ExternalLinkButton';
import type { Presentation } from '@/types/speaker';

interface PresentationDetailsProps extends StackProps {
  presentation: Presentation;
}

/** Topic, event and optional link of one talk. */
export default function PresentationDetails({ presentation, ...stackProps }: PresentationDetailsProps): JSX.Element {
  return (
    <VStack align="stretch" gap="4" {...stackProps}>
      <Box>
        <Text textStyle="fieldLabel" color="brand.400" mb="2">
          Topic
        </Text>
        <Text fontSize="md" color="brand.500" fontWeight="500" lineHeight="1.45" fontStyle="italic">
          &ldquo;{presentation.topic}&rdquo;
        </Text>
      </Box>

      <Box>
        <Text textStyle="fieldLabel" color="brand.400" mb="2">
          Event
        </Text>
        <Text fontSize="sm" color="gray.700" lineHeight="1.5">
          {presentation.event}
        </Text>
      </Box>

      {presentation.link && (
        <Box pt="2">
          <ExternalLinkButton
            href={presentation.link}
            variant="secondary"
            size="sm"
            // Inside a clickable card, the link must not also open the modal.
            onClick={(e) => e.stopPropagation()}
          >
            <Flex align="center" gap="2">
              <ExternalLink size={13} strokeWidth={1.75} />
              <Text>View Presentation</Text>
            </Flex>
          </ExternalLinkButton>
        </Box>
      )}
    </VStack>
  );
}
