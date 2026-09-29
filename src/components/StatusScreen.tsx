import type { JSX } from 'react';
import { Box, Center, Heading, Spinner, Text, VStack } from '@chakra-ui/react';

interface StatusScreenProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  titleColor: string;
  messageColor: string;
  minH: string;
}

function StatusScreen({ icon, title, message, titleColor, messageColor, minH }: StatusScreenProps): JSX.Element {
  return (
    <Center minH={minH} p="8">
      <VStack gap="4" textAlign="center" maxW="lg">
        <Box color={titleColor}>{icon}</Box>
        <Heading as="h2" size="lg" color={titleColor}>
          {title}
        </Heading>
        <Text color={messageColor} fontSize="md">
          {message}
        </Text>
      </VStack>
    </Center>
  );
}

export function LoadingState(): JSX.Element {
  return (
    <StatusScreen
      icon={<Spinner size="xl" color="brand.500" />}
      title="Loading"
      message="Fetching the latest conferences and deadlines..."
      titleColor="brand.600"
      messageColor="gray.600"
      minH="100vh"
    />
  );
}

export function ErrorState({ error }: { error: string }): JSX.Element {
  return (
    <StatusScreen
      icon={
        <Box as="span" fontSize="4xl" role="img" aria-label="Error">
          ⚠️
        </Box>
      }
      title="Something went wrong"
      message={error}
      titleColor="red.500"
      messageColor="gray.700"
      minH="65vh"
    />
  );
}
