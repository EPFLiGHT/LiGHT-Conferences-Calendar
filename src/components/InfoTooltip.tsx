import type { JSX } from 'react';
import { Portal, Tooltip } from '@chakra-ui/react';

interface InfoTooltipProps {
  label: string;
  children: React.ReactNode;
}

export default function InfoTooltip({ label, children }: InfoTooltipProps): JSX.Element {
  return (
    <Tooltip.Root openDelay={150} closeDelay={100}>
      <Tooltip.Trigger asChild>
        {children}
      </Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content
            fontSize="sm"
            borderRadius="md"
            bg="gray.800"
            color="white"
            px="3"
            py="2"
          >
            <Tooltip.Arrow>
              <Tooltip.ArrowTip />
            </Tooltip.Arrow>
            {label}
          </Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}
