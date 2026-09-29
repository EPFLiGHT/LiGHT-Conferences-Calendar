'use client';

import type { JSX } from 'react';
import { useState, useEffect, useRef } from 'react';
import { Box, Portal, Text } from '@chakra-ui/react';
import { X } from 'lucide-react';

interface ModalHeaderProps {
  /** Small uppercase label above the title, e.g. "Conference Dossier". */
  eyebrow: string;
  onClose: () => void;
  /** Title area rendered below the eyebrow. */
  children: React.ReactNode;
}

/**
 * Shared sticky modal header: close button, eyebrow label, title slot.
 * Single source for the header chrome of ConferenceModal and SpeakerModal.
 */
export function ModalHeader({ eyebrow, onClose, children }: ModalHeaderProps): JSX.Element {
  return (
    <Box
      position="sticky"
      top="0"
      bg="white"
      borderBottom="1px solid"
      borderColor="line.strong"
      px={{ base: '6', md: '8' }}
      py={{ base: '5', md: '6' }}
      zIndex="10"
    >
      <Box
        as="button"
        position="absolute"
        top="5"
        right="5"
        w="32px"
        h="32px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        border="1px solid"
        borderColor="line.strong"
        borderRadius="control"
        bg="white"
        color="brand.500"
        cursor="pointer"
        transition="all 0.2s ease"
        _hover={{ bg: 'brand.500', color: 'white', borderColor: 'brand.500' }}
        onClick={onClose}
        aria-label="Close"
      >
        <X size={16} strokeWidth={2} />
      </Box>

      <Text textStyle="eyebrow" color="brand.400" mb="3">
        {eyebrow}
      </Text>
      {children}
    </Box>
  );
}

interface ModalShellProps {
  onClose: () => void;
  /** Accessible name of the dialog. */
  label: string;
  /** Max width of the modal card. */
  maxW?: string;
  /** Card contents. Receives `close` for the header's close button. */
  children: (close: () => void) => React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared modal scaffolding: portal, dimmed backdrop, blur, Escape-to-close,
 * focus trap, page scroll-lock, backdrop-click-to-close, and the white card with
 * its top accent rule. Single source for modal behavior so ConferenceModal and
 * SpeakerModal cannot drift.
 */
export default function ModalShell({
  onClose,
  label,
  maxW = '860px',
  children,
}: ModalShellProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.focus({ preventScroll: true });

    const trapTab = (e: KeyboardEvent) => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active);
      if (e.shiftKey && (outside || active === first || active === dialog)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (outside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'Tab') {
        trapTab(e);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // html has overflow-x: clip, so body's overflow never reaches the viewport.
    const html = document.documentElement;
    const { body } = document;
    const previous = {
      htmlOverflowY: html.style.overflowY,
      bodyOverflowY: body.style.overflowY,
      bodyPaddingRight: body.style.paddingRight,
    };
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    html.style.overflowY = 'hidden';
    body.style.overflowY = 'hidden';
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      html.style.overflowY = previous.htmlOverflowY;
      body.style.overflowY = previous.bodyOverflowY;
      body.style.paddingRight = previous.bodyPaddingRight;
      if (opener instanceof HTMLElement && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <Portal>
      <Box
        position="fixed"
        top="0"
        left="0"
        right="0"
        bottom="0"
        bg="overlay.scrim"
        backdropFilter="blur(2px)"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex="modal"
        p={{ base: '3', md: '6' }}
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        <Box
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          outline="none"
          bg="white"
          borderRadius="card"
          maxW={maxW}
          w="full"
          maxH="90vh"
          overflowY="auto"
          border="1px solid"
          borderColor="brand.500"
          position="relative"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top accent rule */}
          <Box h="3px" bg="brand.500" />
          {children(handleClose)}
        </Box>
      </Box>
    </Portal>
  );
}
