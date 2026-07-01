import { Flex, Text } from '@chakra-ui/react';

interface SectionLabelProps {
  label: React.ReactNode;
  /** Optional right-aligned trailing text (e.g. "§ 01", "Most recent first"). */
  trailing?: React.ReactNode;
  mb?: string;
}

/**
 * Section divider used inside modals: an uppercase label with an optional
 * trailing marker over a hairline rule. Single source for the section-header look.
 */
export default function SectionLabel({ label, trailing, mb = '5' }: SectionLabelProps): JSX.Element {
  return (
    <Flex
      align="baseline"
      justify="space-between"
      pb="3"
      mb={mb}
      borderBottom="1px solid"
      borderColor="line.default"
    >
      <Text textStyle="eyebrow" color="brand.500">
        {label}
      </Text>
      {trailing && (
        <Text textStyle="eyebrow" fontWeight="600" color="brand.400" className="tabular">
          {trailing}
        </Text>
      )}
    </Flex>
  );
}
