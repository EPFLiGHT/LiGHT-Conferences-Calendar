import type { JSX } from 'react';
import { Box } from '@chakra-ui/react';

interface CodeChipProps {
  children: React.ReactNode;
  /** Smaller variant that flows inside a sentence. */
  inline?: boolean;
}

/** Outlined monospace chip for a Slack command. */
export default function CodeChip({ children, inline = false }: CodeChipProps): JSX.Element {
  return (
    <Box
      as="code"
      px={inline ? '2' : '3'}
      py={inline ? '0.5' : '1.5'}
      fontFamily="mono"
      fontSize="xs"
      fontWeight={inline ? undefined : '500'}
      whiteSpace={inline ? undefined : 'nowrap'}
      color="brand.500"
      border="1px solid"
      borderColor="line.strong"
      borderRadius="control"
      className="tabular"
    >
      {children}
    </Box>
  );
}
