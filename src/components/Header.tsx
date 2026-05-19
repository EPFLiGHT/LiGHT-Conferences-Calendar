'use client';

import { usePathname } from 'next/navigation';
import NextLink from 'next/link';
import { Box, Container, Flex, HStack, Link, Text, Image } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { Home, Calendar, Users } from 'lucide-react';

export default function Header(): JSX.Element {
  const pathname = usePathname();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let rafId: number | null = null;
    let ticking = false;

    const updateScrollProgress = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY;
      const scrollableHeight = documentHeight - windowHeight;
      const progress = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;
      setScrollProgress(progress);
      ticking = false;
    };

    const handleScroll = () => {
      if (!ticking) {
        rafId = requestAnimationFrame(updateScrollProgress);
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <Box
      position="sticky"
      top="0"
      zIndex="100"
      bg="rgba(255, 255, 255, 0.92)"
      backdropFilter="blur(12px) saturate(140%)"
      borderBottom="1px solid"
      borderColor="rgba(46, 95, 168, 0.18)"
    >
      {/* Scroll Progress Bar */}
      <Box
        position="absolute"
        bottom="-1px"
        left="0"
        h="1px"
        w={`${scrollProgress}%`}
        bg="brand.500"
        transition="width 0.1s linear"
        style={{ willChange: 'width' }}
      />
      <Container maxW="1200px" px={{ base: '4', md: '6' }} mx="auto">
        <Flex align="center" justify="space-between" py="5" gap={{ base: '2', md: '8' }}>
          {/* Logo and Brand */}
          <Flex align="center" gap={{ base: '2', md: '6' }} flex="1">
            <Link
              as="a"
              href="https://www.light-laboratory.org/"
              target="_blank"
              rel="noopener noreferrer"
              display="flex"
              alignItems="center"
              gap="4"
              transition="all 0.3s"
              _hover={{ transform: 'scale(1.05)' }}
            >
              <Image
                src="/light-logo-new.png"
                alt="LiGHT Lab"
                h={{ base: '36px', md: '52px' }}
                w="auto"
                maxW={{ base: '120px', md: 'none' }}
                objectFit="contain"
                transition="opacity 0.2s ease"
                _hover={{ opacity: 0.85 }}
              />
              <Box display={{ base: 'none', lg: 'block' }}>
                <Text fontSize="xs" fontWeight="500" color="brand.500" lineHeight="1.4" textTransform="uppercase" letterSpacing="0.12em">
                  Laboratory for Intelligent
                </Text>
                <Text fontSize="xs" fontWeight="500" color="brand.400" lineHeight="1.4" textTransform="uppercase" letterSpacing="0.12em">
                  Global Health &amp; Humanitarian
                </Text>
                <Text fontSize="xs" fontWeight="500" color="brand.400" lineHeight="1.4" textTransform="uppercase" letterSpacing="0.12em">
                  Response Technologies
                </Text>
              </Box>
            </Link>

            <Box
              w="1px"
              h="48px"
              bg="rgba(46, 95, 168, 0.22)"
              display={{ base: 'none', md: 'block' }}
            />

            <Box>
              <Text
                fontSize="xl"
                fontWeight="600"
                color="brand.500"
                lineHeight="1.15"
                letterSpacing="-0.015em"
              >
                Conference Deadlines
              </Text>
              <Text
                fontSize="11px"
                color="brand.400"
                mt="1.5"
                textTransform="uppercase"
                letterSpacing="0.2em"
                fontWeight="500"
              >
                Track research deadlines
              </Text>
            </Box>
          </Flex>

          {/* Navigation */}
          <HStack gap={{ base: '1.5', sm: '3' }}>
            {[
              { href: '/', label: 'Home', Icon: Home },
              { href: '/calendar', label: 'Calendar', Icon: Calendar },
              { href: '/speakers', label: 'Speakers', Icon: Users },
            ].map(({ href, label, Icon }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  as={NextLink}
                  href={href}
                  px={{ base: '2.5', sm: '4' }}
                  py="2"
                  fontWeight="500"
                  fontSize="sm"
                  color={isActive ? 'brand.500' : 'brand.400'}
                  bg="transparent"
                  borderRadius="0"
                  position="relative"
                  textTransform="uppercase"
                  letterSpacing="0.14em"
                  transition="color 0.2s ease"
                  _hover={{
                    color: 'brand.500',
                    bg: 'transparent',
                    textDecoration: 'none',
                  }}
                  _after={{
                    content: '""',
                    position: 'absolute',
                    left: { base: '10px', sm: '16px' },
                    right: { base: '10px', sm: '16px' },
                    bottom: '4px',
                    height: '1px',
                    bg: isActive ? 'brand.500' : 'transparent',
                  }}
                >
                  <Flex align="center" gap="2">
                    <Icon size={14} strokeWidth={1.5} />
                    <Text as="span" display={{ base: 'none', sm: 'inline' }}>{label}</Text>
                  </Flex>
                </Link>
              );
            })}
          </HStack>
        </Flex>
      </Container>
    </Box>
  );
}
