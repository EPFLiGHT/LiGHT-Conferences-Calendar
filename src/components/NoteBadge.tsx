import type { JSX } from 'react';
import { Badge, BadgeProps } from '@chakra-ui/react';

interface NoteBadgeProps extends Omit<BadgeProps, 'children'> {
  note: string;
  layout?: 'card' | 'modal';
}

const BASE_BADGE_PROPS: Partial<BadgeProps> = {
  px: '2',
  fontSize: 'xs',
  fontWeight: '600',
  textTransform: 'uppercase',
  borderRadius: 'md',
  bg: 'blue.100',
  color: 'blue.800',
  wordBreak: 'break-word',
  whiteSpace: 'normal',
};

const LAYOUT_PROPS: Record<NonNullable<NoteBadgeProps['layout']>, Partial<BadgeProps>> = {
  card: {
    py: '1',
    alignSelf: 'flex-start',
    maxW: 'fit-content',
  },
  modal: {
    py: '0.5',
    maxW: '100%',
  },
};

export default function NoteBadge({
  note,
  layout = 'card',
  ...rest
}: NoteBadgeProps): JSX.Element {
  return (
    <Badge
      {...BASE_BADGE_PROPS}
      {...LAYOUT_PROPS[layout]}
      {...rest}
    >
      {note}
    </Badge>
  );
}
