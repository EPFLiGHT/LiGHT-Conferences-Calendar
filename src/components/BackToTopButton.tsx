'use client';

import type { JSX } from 'react';
import { Box } from '@chakra-ui/react';
import { ArrowUp } from 'lucide-react';

export default function BackToTopButton(): JSX.Element {
  return (
    <Box
      as="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      display="inline-flex"
      alignItems="center"
      gap="1.5"
      textStyle="metaLabel"
      color="brand.500"
      border="1px solid"
      borderColor="brand.500"
      px="3"
      py="1.5"
      cursor="pointer"
      transition="all 0.2s ease"
      _hover={{ bg: 'brand.500', color: 'white' }}
    >
      Top
      <ArrowUp size={11} strokeWidth={2} />
    </Box>
  );
}
