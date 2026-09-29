/**
 * Button style objects, spread onto Chakra Buttons:
 * <Button {...primaryButtonStyle}>Click me</Button>
 */

import type { ButtonProps } from '@chakra-ui/react';

const TRANSITION = 'all 0.2s ease-in-out';

export const primaryButtonStyle: Partial<ButtonProps> = {
  bg: 'brand.500',
  color: 'white',
  fontWeight: '600',
  borderRadius: 'control',
  border: '1px solid',
  borderColor: 'brand.500',
  transition: TRANSITION,
  _hover: {
    bg: 'brand.700',
    borderColor: 'brand.700',
  },
  _active: {
    bg: 'brand.700',
  },
  _disabled: {
    bg: 'gray.100',
    borderColor: 'gray.200',
    color: 'gray.400',
    cursor: 'not-allowed',
    _hover: {
      bg: 'gray.100',
      borderColor: 'gray.200',
    },
  },
};

export const secondaryButtonStyle: Partial<ButtonProps> = {
  bg: 'white',
  color: 'brand.500',
  fontWeight: '600',
  borderRadius: 'control',
  border: '1px solid',
  borderColor: 'brand.500',
  transition: TRANSITION,
  _hover: {
    bg: 'brand.50',
    color: 'brand.700',
    borderColor: 'brand.700',
  },
  _active: {
    bg: 'brand.50',
  },
};
