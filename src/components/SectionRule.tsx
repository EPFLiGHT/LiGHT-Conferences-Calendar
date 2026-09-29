import type { JSX } from 'react';
import { Flex, Text, type FlexProps } from '@chakra-ui/react';

interface SectionRuleProps extends Omit<FlexProps, 'children'> {
  label: React.ReactNode;
  trailing?: React.ReactNode;
  labelColor?: string;
  /** `page` above grids and lists, `modal` for the bolder section headers inside dialogs. */
  variant?: 'page' | 'modal';
}

const VARIANTS = {
  page: { mb: '6', label: { textStyle: 'metaLabel' }, trailing: { textStyle: 'metaLabel' } },
  modal: { mb: '5', label: { textStyle: 'eyebrow' }, trailing: { textStyle: 'eyebrow', fontWeight: '600' } },
} as const;

/** Section heading: a label and optional trailing marker on a baseline, over a hairline rule. */
export default function SectionRule({
  label,
  trailing,
  labelColor = 'brand.500',
  variant = 'page',
  ...rest
}: SectionRuleProps): JSX.Element {
  const styles = VARIANTS[variant];
  return (
    <Flex
      align="baseline"
      justify="space-between"
      gap="4"
      flexWrap="wrap"
      pb="3"
      mb={styles.mb}
      borderBottom="1px solid"
      borderColor="line.default"
      {...rest}
    >
      <Text {...styles.label} color={labelColor} className="tabular">
        {label}
      </Text>
      {trailing != null && (
        <Text {...styles.trailing} color="brand.400" className="tabular">
          {trailing}
        </Text>
      )}
    </Flex>
  );
}
