import { Flex, Text, type FlexProps } from '@chakra-ui/react';

interface SectionRuleProps extends Omit<FlexProps, 'children'> {
  label: React.ReactNode;
  trailing?: React.ReactNode;
  labelColor?: string;
  trailingColor?: string;
}

/**
 * Shared "section rule" heading: two small uppercase labels on a baseline,
 * closed by a hairline bottom border. Used above grids and lists across pages.
 */
export default function SectionRule({
  label,
  trailing,
  labelColor = 'brand.500',
  trailingColor = 'brand.400',
  ...rest
}: SectionRuleProps): JSX.Element {
  return (
    <Flex
      align="baseline"
      justify="space-between"
      gap="4"
      flexWrap="wrap"
      pb="3"
      mb="6"
      borderBottom="1px solid"
      borderColor="line.default"
      {...rest}
    >
      <Text textStyle="metaLabel" color={labelColor} className="tabular">
        {label}
      </Text>
      {trailing != null && (
        <Text textStyle="metaLabel" color={trailingColor} className="tabular">
          {trailing}
        </Text>
      )}
    </Flex>
  );
}
