'use client';

import Link from 'next/link';
import { Box, Flex, Text, Heading, Grid, Image, Link as ChakraLink } from '@chakra-ui/react';
import { Bell, Search, SlidersHorizontal } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageShell from '@/components/PageShell';
import SectionRule from '@/components/SectionRule';
import CodeChip from '@/components/CodeChip';
import { COMMAND_DESCRIPTIONS } from '@/slack-bot/config/constants';
import { ROUTES, EXTERNAL_URLS } from '@/constants/routes';
import { inlineLinkStyle } from '@/styles/linkStyles';

const FEATURES = [
  {
    Icon: Bell,
    title: 'Smart Notifications',
    description: 'Reminders 30, 7, and 3 days before each deadline.',
  },
  {
    Icon: Search,
    title: 'Quick Search',
    description: 'Search conferences by name or subject area.',
  },
  {
    Icon: SlidersHorizontal,
    title: 'Browse by Subject',
    description: 'List upcoming deadlines by subject: ML, CV, NLP, Security, and more.',
  },
];

/** Slack bot landing page with the "Add to Slack" OAuth button. */
export default function SlackInstallPage() {
  return (
    <>
      <Header />
      <PageShell maxW="960px">
        {/* Eyebrow */}
        <Text textStyle="eyebrow" color="brand.400" textAlign="center" mb="6">
          LiGHT · Slack Integration
        </Text>

        {/* Hero */}
        <Box textAlign="center" mb="14">
          <Flex justify="center" mb="8">
            <Image
              src="/slack-bot-logo.png"
              alt="LiGHT Events Radar Slack bot"
              h={{ base: '88px', md: '104px' }}
              w="auto"
              borderRadius="hero"
              border="1px solid"
              borderColor="line.default"
            />
          </Flex>

          <Heading
            as="h1"
            fontSize={{ base: '3xl', md: '5xl' }}
            fontWeight="600"
            color="brand.500"
            letterSpacing="-0.02em"
            lineHeight="1.1"
            mb="5"
          >
            LiGHT Events Radar for Slack
          </Heading>

          <Text
            fontSize={{ base: 'md', md: 'lg' }}
            color="gray.600"
            maxW="2xl"
            mx="auto"
            lineHeight="1.6"
            mb="10"
          >
            Get deadline reminders in your DMs or channels, and search conferences by name
            or subject, straight from Slack.
          </Text>

          <Flex justify="center" mb="5">
            <ChakraLink
              href={EXTERNAL_URLS.slackOauthInstall}
              display="inline-block"
              transition="opacity 0.2s ease"
              _hover={{ opacity: 0.85 }}
            >
              <Image
                src="https://platform.slack-edge.com/img/add_to_slack.png"
                srcSet="https://platform.slack-edge.com/img/add_to_slack.png 1x, https://platform.slack-edge.com/img/add_to_slack@2x.png 2x"
                alt="Add to Slack"
                h="44px"
                w="auto"
              />
            </ChakraLink>
          </Flex>

          <Text textStyle="metaLabel" color="brand.400">
            Free for all Slack workspaces
          </Text>

          <Text fontSize="xs" color="gray.500" mt="3">
            By installing, you agree to our{' '}
            <ChakraLink asChild {...inlineLinkStyle} fontWeight="600">
              <Link href={ROUTES.slackPrivacy}>Privacy Policy</Link>
            </ChakraLink>
          </Text>
        </Box>

        <SectionRule label="What you get" trailing="01 / 02" />

        {/* Features Grid */}
        <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap="0" mb="16">
          {FEATURES.map(({ Icon, title, description }, index) => (
            <Box
              key={title}
              p="6"
              borderTop={{ base: '1px solid', md: 'none' }}
              borderBottom={{ base: index === FEATURES.length - 1 ? '1px solid' : 'none', md: 'none' }}
              borderRight={{ base: 'none', md: index < FEATURES.length - 1 ? '1px solid' : 'none' }}
              borderColor="line.default"
            >
              {/* Colored on a wrapper: color on the card would also recolor its currentColor borders. */}
              <Box color="brand.500">
                <Icon size={20} strokeWidth={1.5} />
              </Box>
              <Heading
                as="h3"
                fontSize="md"
                fontWeight="600"
                color="brand.500"
                mt="4"
                mb="2"
                letterSpacing="-0.005em"
              >
                {title}
              </Heading>
              <Text fontSize="sm" color="gray.600" lineHeight="1.55">
                {description}
              </Text>
            </Box>
          ))}
        </Grid>

        <SectionRule label="Available commands" trailing="02 / 02" />

        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap="0" mb="16">
          {Object.entries(COMMAND_DESCRIPTIONS).map(([cmd, desc], idx, arr) => {
            const isLastRow = idx >= arr.length - 2;
            const isRight = idx % 2 === 1;
            return (
              <Flex
                key={cmd}
                align="center"
                gap="4"
                py="4"
                px={{ base: '0', md: '5' }}
                borderBottom={!isLastRow ? '1px solid' : 'none'}
                borderRight={{ base: 'none', md: !isRight ? '1px solid' : 'none' }}
                borderColor="line.subtle"
              >
                <CodeChip>{cmd}</CodeChip>
                <Text fontSize="sm" color="gray.600" flex="1" lineHeight="1.5">
                  {desc}
                </Text>
              </Flex>
            );
          })}
        </Grid>
      </PageShell>
      <Footer />
    </>
  );
}
