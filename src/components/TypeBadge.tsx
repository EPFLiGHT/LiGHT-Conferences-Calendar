import type { JSX } from 'react';
import { Text } from '@chakra-ui/react';

interface TypeBadgeProps {
  type: string;
}

export default function TypeBadge({ type }: TypeBadgeProps): JSX.Element | null {
  if (!type) return null;

  return (
    <Text
      as="span"
      textStyle="badgeLabel"
      color="brand.500"
      border="1px solid"
      borderColor="line.strong"
      borderRadius="badge"
      px="2"
      py="1"
      whiteSpace="nowrap"
      lineHeight="1"
    >
      {type}
    </Text>
  );
}
