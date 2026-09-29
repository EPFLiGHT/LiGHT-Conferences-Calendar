'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Box, Flex, Grid, Text, Link as ChakraLink, Spinner } from '@chakra-ui/react';
import { ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageShell from '@/components/PageShell';
import PageMasthead from '@/components/PageMasthead';
import SectionRule from '@/components/SectionRule';
import AccentCard from '@/components/AccentCard';
import CodeChip from '@/components/CodeChip';
import { inlineLinkStyle } from '@/styles/linkStyles';

const FIRST_STEPS = [
  { num: '01', cmd: '/conf-help', desc: 'See every command the bot understands.' },
  { num: '02', cmd: '/conf-upcoming', desc: 'Show the next five conference deadlines.' },
  { num: '03', cmd: '/conf-subscribe', desc: 'Get deadline reminders in your DMs.' },
];

// useSearchParams needs the Suspense boundary below.
function SuccessContent() {
  const teamName = useSearchParams().get('team') || 'your workspace';

  return (
    <>
      <Header />
      <PageShell maxW="960px">
        <PageMasthead
          eyebrow="LiGHT · Slack Integration"
          title="Installation complete."
          description="The Conferences Calendar bot can now post deadline reminders in your workspace."
        />

        {/* Installation receipt */}
        <AccentCard maxW="640px" mb="14">
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
        </AccentCard>

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
              <CodeChip>{step.cmd}</CodeChip>
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
      </PageShell>
      <Footer />
    </>
  );
}

/** Landing page after a successful Slack OAuth install. */
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
