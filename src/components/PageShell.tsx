import type { JSX } from 'react';
import { Box, Container, type ContainerProps } from '@chakra-ui/react';

interface PageShellProps {
  children: React.ReactNode;
  maxW?: ContainerProps['maxW'];
}

/** Page body: minimum height plus a centered container with the app's gutters. */
export default function PageShell({ children, maxW = '1200px' }: PageShellProps): JSX.Element {
  return (
    <Box py={{ base: '6', md: '8' }} pb={{ base: '12', md: '16' }} minH="calc(100vh - 200px)">
      <Container maxW={maxW} px={{ base: '4', md: '6' }} mx="auto">
        {children}
      </Container>
    </Box>
  );
}
