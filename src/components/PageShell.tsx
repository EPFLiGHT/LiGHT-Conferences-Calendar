import type { JSX } from 'react';
import { Box, Container } from '@chakra-ui/react';
import type { BoxProps } from '@chakra-ui/react';

interface PageShellProps {
  children: React.ReactNode;
  py?: BoxProps['py'];
  pb?: BoxProps['pb'];
  bg?: BoxProps['bg'];
}

/**
 * Standard page body: full-height min-height and a centered 1200px container
 * with the app's responsive gutter. Single source for the page shell so the
 * width/padding rhythm is defined once. `py`/`pb`/`bg` override for variants
 * (e.g. the marketing/slack-install pages).
 */
export default function PageShell({
  children,
  py = { base: '6', md: '8' },
  pb = { base: '12', md: '16' },
  bg,
}: PageShellProps): JSX.Element {
  return (
    <Box py={py} pb={pb} minH="calc(100vh - 200px)" bg={bg}>
      <Container maxW="1200px" px={{ base: '4', md: '6' }} mx="auto">
        {children}
      </Container>
    </Box>
  );
}
