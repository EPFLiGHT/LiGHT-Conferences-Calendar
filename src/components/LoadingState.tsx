import type { JSX } from 'react';
import { Spinner } from '@chakra-ui/react';
import StatusMessage from './StatusMessage';

interface LoadingStateProps {
  message?: string;
  title?: string;
}

export default function LoadingState({
  message = 'Fetching the latest conferences and deadlines...',
  title = 'Loading',
}: LoadingStateProps): JSX.Element {
  return (
    <StatusMessage
      tone="info"
      title={title}
      message={message}
      icon={<Spinner size="xl" color="brand.500" />}
      minH="100vh"
    />
  );
}
