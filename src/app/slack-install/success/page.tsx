'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Container, Flex, Text, Heading, Grid, Link as ChakraLink, Spinner } from '@chakra-ui/react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { COLORS, SHADOWS, brandAlpha } from '@/theme';

/**
 * Inner component that uses useSearchParams
 * Must be wrapped in Suspense boundary
 */
function SuccessContent() {
  const searchParams = useSearchParams();
  const [teamName, setTeamName] = useState<string>('');

  useEffect(() => {
    const name = searchParams.get('team') || 'your workspace';
    setTeamName(name);
  }, [searchParams]);

  return (
    <>
      <style>
        {`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
          }
        `}
      </style>
      <Header />
      <Box py={{ base: '12', md: '20' }} minH="calc(100vh - 200px)">
        <Container maxW="900px" px={{ base: '4', md: '6' }} mx="auto">
          {/* Success Card */}
          <Box
            bg="white"
            borderRadius="pill"
            border="2px solid"
            borderColor="brand.200"
            boxShadow={`0 8px 32px ${brandAlpha(0.15)}`}
            p={{ base: '8', md: '12' }}
            textAlign="center"
          >
            {/* Animated Emoji */}
            <Flex justify="center" mb="6">
              <Box
                fontSize="8xl"
                lineHeight="1"
                as="span"
                display="inline-block"
                style={{
                  animation: 'bounce 1s ease infinite',
                }}
              >
                🎉
              </Box>
            </Flex>

            {/* Title */}
            <Heading
              as="h1"
              fontSize={{ base: '3xl', md: '4xl' }}
              fontWeight="800"
              mb="6"
              bgGradient="to-r"
              gradientFrom="brand.600"
              gradientTo="brand.400"
              bgClip="text"
              lineHeight="1.2"
            >
              Installation Successful!
            </Heading>

            {/* Description */}
            <Text fontSize={{ base: 'lg', md: 'xl' }} color="gray.700" mb="2">
              The Conferences Calendar Bot has been successfully installed to
            </Text>
            <Box
              display="inline-block"
              px="4"
              py="2"
              bg="brand.50"
              borderRadius="sheet"
              border="1px solid"
              borderColor="brand.200"
              mb="10"
            >
              <Text fontSize="xl" fontWeight="700" color="brand.600">
                {teamName}
              </Text>
            </Box>

            {/* Quick Start Commands */}
            <Box
              p={{ base: '6', md: '8' }}
              bg={`linear-gradient(135deg, ${COLORS.brand[50]} 0%, ${COLORS.brand[100]} 100%)`}
              borderRadius="hero"
              border="1px solid"
              borderColor="brand.200"
              mb="8"
            >
              <Heading
                as="h2"
                fontSize={{ base: 'lg', md: 'xl' }}
                fontWeight="700"
                color="gray.800"
                mb="6"
              >
                🚀 Quick Start - Try These Commands:
              </Heading>

              <Grid
                templateColumns={{ base: '1fr', md: '1fr' }}
                gap="4"
                textAlign="left"
              >
                {[
                  { cmd: '/conf-help', desc: 'See all available commands', emoji: '📚' },
                  { cmd: '/conf-upcoming', desc: 'Show next 5 deadlines', emoji: '📅' },
                  { cmd: '/conf-subscribe', desc: 'Enable personalized notifications', emoji: '🔔' },
                  { cmd: '/conf-search <name>', desc: 'Search for a conference', emoji: '🔍' },
                ].map((command, index) => (
                  <Flex
                    key={index}
                    align="center"
                    gap="4"
                    p="4"
                    bg="white"
                    borderRadius="sheet"
                    border="1px solid"
                    borderColor="brand.100"
                    transition="all 0.2s ease"
                    _hover={{
                      borderColor: 'brand.300',
                      transform: 'translateX(4px)',
                      boxShadow: SHADOWS.md,
                    }}
                  >
                    <Text fontSize="2xl">{command.emoji}</Text>
                    <Box
                      as="code"
                      px="3"
                      py="2"
                      bg="brand.50"
                      borderRadius="panel"
                      fontFamily="mono"
                      fontSize="sm"
                      fontWeight="600"
                      color="brand.600"
                      border="1px solid"
                      borderColor="brand.200"
                      whiteSpace="nowrap"
                    >
                      {command.cmd}
                    </Box>
                    <Text fontSize="sm" color="gray.600" flex="1">
                      {command.desc}
                    </Text>
                  </Flex>
                ))}
              </Grid>
            </Box>

            {/* Open Slack Button */}
            <ChakraLink
              href="slack://open"
              display="inline-block"
              px="10"
              py="4"
              bg="brand.500"
              color="white"
              borderRadius="sheet"
              fontWeight="600"
              fontSize="lg"
              textDecoration="none"
              transition="all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
              boxShadow={`0 4px 12px ${brandAlpha(0.3)}`}
              _hover={{
                bg: 'brand.600',
                transform: 'translateY(-2px) scale(1.05)',
                boxShadow: `0 8px 20px ${brandAlpha(0.4)}`,
              }}
              _active={{
                transform: 'scale(0.98)',
              }}
            >
              Open Slack →
            </ChakraLink>
          </Box>
        </Container>
      </Box>
      <Footer />
    </>
  );
}

/**
 * OAuth Success Page
 * Displayed after successful Slack bot installation
 */
export default function SlackInstallSuccessPage() {
  return (
    <Suspense
      fallback={
        <Box minH="100vh" display="flex" alignItems="center" justifyContent="center">
          <Spinner size="xl" color="brand.500" />
        </Box>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
