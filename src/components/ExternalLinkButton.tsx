/**
 * ExternalLinkButton Component
 *
 * Reusable button component for external links (Website, Papers, PWC).
 * Wraps a Link and Button with consistent styling and behavior.
 * Supports primary and secondary variants with configurable sizes.
 */

import type { JSX } from 'react';
import { Button, Link, ButtonProps } from '@chakra-ui/react';
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
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      textDecoration="none"
    >
      <Button
        size={size}
        px={px}
        fontSize="sm"
        {...buttonStyle}
        onClick={onClick}
      >
        {children}
      </Button>
    </Link>
  );
}
