'use client';

import { useState, useEffect } from 'react';
import { Box, Portal } from '@chakra-ui/react';

interface ModalShellProps {
  onClose: () => void;
  /** Max width of the modal card. */
  maxW?: string;
  /** Card contents. Receives `close` for the header's close button. */
  children: (close: () => void) => React.ReactNode;
}

/**
 * Shared modal scaffolding: portal, dimmed backdrop, blur, Escape-to-close,
 * body scroll-lock, backdrop-click-to-close, and the white card with its top
 * accent rule. Single source for modal behavior so ConferenceModal and
 * SpeakerModal cannot drift.
 */
export default function ModalShell({
  onClose,
  maxW = '860px',
  children,
}: ModalShellProps): JSX.Element | null {
  const [isOpen, setIsOpen] = useState(true);

  const handleClose = () => {
    setIsOpen(false);
    onClose();
  };

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
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
