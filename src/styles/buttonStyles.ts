/**
 * Button Styles
 *
 * Reusable button style objects that can be spread onto Button components.
 * Provides consistent styling for primary, secondary, and brand buttons.
 *
 * Usage: <Button {...primaryButtonStyle}>Click me</Button>
 */

import { ButtonProps } from '@chakra-ui/react';
import { SHADOWS, TRANSITIONS } from '@/theme';

export const primaryButtonStyle: Partial<ButtonProps> = {
  bg: 'brand.500',
  color: 'white',
  fontWeight: '600',
  borderRadius: '3px',
  border: '1px solid',
  borderColor: 'brand.500',
  transition: TRANSITIONS.normal,
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
  borderRadius: '3px',
  border: '1px solid',
  borderColor: 'brand.500',
  transition: TRANSITIONS.normal,
  _hover: {
    bg: 'brand.50',
    color: 'brand.700',
    borderColor: 'brand.700',
  },
  _active: {
    bg: 'brand.50',
  },
};

export const brandButtonStyle: Partial<ButtonProps> = {
  bg: 'brand.400',
  color: 'white',
  transition: TRANSITIONS.normal,
  position: 'relative',
  zIndex: 1,
  _hover: {
    bg: 'brand.500',
    transform: 'translateY(-2px)',
    boxShadow: SHADOWS.hover.brand,
  },
  _active: {
    transform: 'scale(0.98)',
  },
};
