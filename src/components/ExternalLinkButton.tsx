/**
 * ExternalLinkButton Component
 *
 * Reusable button component for external links (Website, Papers).
 * A single link styled as a Button.
 * Supports primary and secondary variants with configurable sizes.
 */

import type { JSX } from 'react';
import { Button, ButtonProps } from '@chakra-ui/react';
import { primaryButtonStyle, secondaryButtonStyle } from '@/styles/buttonStyles';

interface ExternalLinkButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
  onClick?: (e: React.MouseEvent) => void;
  size?: ButtonProps['size'];
  px?: ButtonProps['px'];
}

export default function ExternalLinkButton({
  href,
  children,
  variant = 'primary',
  onClick,
  size = 'sm',
  px = '4'
}: ExternalLinkButtonProps): JSX.Element {
  const buttonStyle = variant === 'primary' ? primaryButtonStyle : secondaryButtonStyle;

  return (
    <Button
      asChild
      size={size}
      px={px}
      fontSize="sm"
      textDecoration="none"
      {...buttonStyle}
    >
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
        {children}
      </a>
    </Button>
  );
}
