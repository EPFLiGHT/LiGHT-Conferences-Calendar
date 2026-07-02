'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Container, Flex, Grid, Heading, Text, Link as ChakraLink, Spinner } from '@chakra-ui/react';
import { ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import SectionRule from '@/components/SectionRule';
import { inlineLinkStyle } from '@/styles/linkStyles';

const FIRST_STEPS = [
  { num: '01', cmd: '/conf-help', desc: 'See every command the bot understands.' },
  { num: '02', cmd: '/conf-upcoming', desc: 'Show the next five conference deadlines.' },
  { num: '03', cmd: '/conf-subscribe', desc: 'Get deadline reminders in your DMs.' },
];

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
      <Header />
      <Box py={{ base: '10', md: '16' }} minH="calc(100vh - 200px)" bg="white">
        <Container maxW="960px" px={{ base: '4', md: '6' }} mx="auto">
          {/* Masthead */}
          <Text textStyle="eyebrow" color="brand.400" mb="5">
            LiGHT · Slack Integration
          </Text>

          <Heading
            as="h1"
            fontSize={{ base: '4xl', md: '6xl' }}
            fontWeight="600"
            color="brand.500"
            letterSpacing="-0.025em"
            lineHeight="1"
            mb="6"
          >
            Installation complete.
          </Heading>

          <Flex
            align="baseline"
            justify="space-between"
            pb="4"
            mb="10"
            borderBottom="1px solid"
            borderColor="brand.500"
            gap="4"
            flexWrap="wrap"
          >
            <Text fontSize="sm" color="gray.600" maxW="640px" lineHeight="1.6">
              The Conferences Calendar bot can now post deadline reminders in your workspace.
            </Text>
          </Flex>

          {/* Installation receipt */}
          <Box
            border="1px solid"
            borderColor="line.strong"
            position="relative"
            maxW="640px"
            mb="14"
          >
            <Box position="absolute" top="-1px" left="-1px" w="24px" h="3px" bg="brand.500" />
            <Grid templateColumns={{ base: '1fr', sm: '1fr 1fr' }}>
              <Box p="5" borderRight={{ base: 'none', sm: '1px solid' }} borderBottom={{ base: '1px solid', sm: 'none' }} borderColor="line.default">
                <Text textStyle="fieldLabel" color="brand.400" mb="2">
                  Workspace
                </Text>
                <Text fontSize="md" fontWeight="600" color="brand.500">
                  {teamName}
                </Text>
              </Box>
              <Box p="5">
                <Text textStyle="fieldLabel" color="brand.400" mb="2">
                  Status
                </Text>
                <Flex align="center" gap="2">
                  <Box w="7px" h="7px" borderRadius="full" bg="brand.500" />
                  <Text fontSize="md" fontWeight="600" color="brand.500">
                    Active
                  </Text>
                </Flex>
              </Box>
            </Grid>
          </Box>

          {/* First steps */}
          <SectionRule label="First steps" trailing="01 – 03" />

          <Box mb="12" maxW="640px">
            {FIRST_STEPS.map((step, index) => (
              <Flex
                key={step.cmd}
                align="center"
                gap={{ base: '4', md: '6' }}
                py="4"
                borderBottom={index < FIRST_STEPS.length - 1 ? '1px solid' : 'none'}
                borderColor="line.subtle"
                flexWrap="wrap"
              >
                <Text textStyle="metaLabel" color="brand.400" className="tabular">
                  {step.num}
                </Text>
                <Box
                  as="code"
                  px="3"
                  py="1.5"
                  fontFamily="mono"
                  fontSize="xs"
                  fontWeight="500"
                  color="brand.500"
                  border="1px solid"
                  borderColor="line.strong"
                  borderRadius="control"
                  whiteSpace="nowrap"
                  className="tabular"
                >
                  {step.cmd}
                </Box>
                <Text fontSize="sm" color="gray.600" flex="1" lineHeight="1.5">
                  {step.desc}
                </Text>
              </Flex>
            ))}
          </Box>

          {/* Actions */}
          <Flex align="center" gap="6" flexWrap="wrap" mb="4">
            <ChakraLink
              href="slack://open"
              display="inline-flex"
              alignItems="center"
              gap="2"
              textStyle="metaLabel"
              color="brand.500"
              border="1px solid"
              borderColor="brand.500"
              px="5"
              py="2.5"
              transition="all 0.2s ease"
              _hover={{ bg: 'brand.500', color: 'white', textDecoration: 'none' }}
            >
              Open Slack
              <ArrowUpRight size={12} strokeWidth={2} />
            </ChakraLink>
            <ChakraLink href="/" fontSize="sm" {...inlineLinkStyle}>
              Browse the conference calendar
            </ChakraLink>
          </Flex>

          <Text fontSize="xs" color="gray.500" lineHeight="1.6">
            The bot also posts a daily digest to any channel you invite it to.
          </Text>
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
