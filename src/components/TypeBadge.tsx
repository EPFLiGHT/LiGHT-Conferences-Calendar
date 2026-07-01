import { Text } from '@chakra-ui/react';

interface TypeBadgeProps {
  type: string;
}

export default function TypeBadge({ type }: TypeBadgeProps): JSX.Element | null {
  if (!type) return null;

  return (
    <Text
      as="span"
      fontSize="10px"
      fontWeight="700"
      color="brand.500"
      textTransform="uppercase"
      letterSpacing="0.2em"
      border="1px solid"
      borderColor="line.strong"
      borderRadius="2px"
      px="2"
      py="1"
      whiteSpace="nowrap"
      lineHeight="1"
    >
      {type}
    </Text>
  );
}
