import type { JSX } from 'react';
import { Box, Button } from '@chakra-ui/react';
import StatusMessage from './StatusMessage';

interface ErrorStateProps {
  error: string;
  title?: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({
  error,
  title = 'Something went wrong',
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps): JSX.Element {
  const actions = onRetry ? (
    <Button onClick={onRetry} colorScheme="red" variant="solid">
      {retryLabel}
    </Button>
  ) : undefined;

  return (
    <StatusMessage
      tone="error"
      title={title}
      message={error}
      icon={(
        <Box as="span" fontSize="4xl" role="img" aria-label="Error">
          ⚠️
        </Box>
      )}
      actions={actions}
    />
  );
}
