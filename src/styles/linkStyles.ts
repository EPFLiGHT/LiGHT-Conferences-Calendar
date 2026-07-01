import type { LinkProps } from '@chakra-ui/react';

/**
 * Inline text link: brand color with an underline that darkens on hover.
 * Single source for the in-prose link look across the marketing pages.
 */
export const inlineLinkStyle: Partial<LinkProps> = {
  color: 'brand.500',
  fontWeight: 500,
  borderBottom: '1px solid',
  borderColor: 'line.hover',
  pb: '1px',
  transition: 'all 0.2s ease',
  _hover: { color: 'brand.700', borderColor: 'brand.700', textDecoration: 'none' },
};
