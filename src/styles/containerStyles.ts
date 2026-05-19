import { BoxProps } from '@chakra-ui/react';

export const whiteCardStyle: Partial<BoxProps> = {
  bg: 'white',
  borderRadius: '4px',
  border: '1px solid',
  borderColor: 'rgba(46, 95, 168, 0.22)',
};

export const paginationContainerStyle: Partial<BoxProps> = {
  ...whiteCardStyle,
  p: '6',
};
