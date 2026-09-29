import type { JSX } from 'react';
import { Box, type BoxProps } from '@chakra-ui/react';

/** Outlined panel with a short brand tab on its top-left corner. */
export default function AccentCard({ children, ...boxProps }: BoxProps): JSX.Element {
  return (
    <Box position="relative" border="1px solid" borderColor="line.strong" {...boxProps}>
      <Box position="absolute" top="-1px" left="-1px" w="24px" h="3px" bg="brand.500" />
      {children}
    </Box>
  );
}
