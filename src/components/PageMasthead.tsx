import type { JSX } from 'react';
import { Box, Flex, Heading, Text, type BoxProps } from '@chakra-ui/react';

interface PageMastheadProps {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  /** Right side of the rule line, e.g. a count or a reset button. */
  trailing?: React.ReactNode;
  mb?: BoxProps['mb'];
}

/** Page heading block: eyebrow, h1, and a description over a brand rule. */
export default function PageMasthead({
  eyebrow,
  title,
  description,
  trailing,
  mb = '10',
}: PageMastheadProps): JSX.Element {
  return (
    <Box mb={mb}>
      <Text textStyle="eyebrow" color="brand.400" mb="4">
        {eyebrow}
      </Text>

      <Heading
        as="h1"
        fontSize={{ base: '3xl', md: '5xl' }}
        fontWeight="600"
        color="brand.500"
        letterSpacing="-0.022em"
        lineHeight="1.05"
        mb="4"
      >
        {title}
      </Heading>

      <Flex
        align="baseline"
        justify="space-between"
        gap="4"
        flexWrap="wrap"
        pb="4"
        borderBottom="1px solid"
        borderColor="brand.500"
      >
        <Text fontSize="sm" color="gray.600" maxW="640px" lineHeight="1.55">
          {description}
        </Text>
        {trailing}
      </Flex>
    </Box>
  );
}
