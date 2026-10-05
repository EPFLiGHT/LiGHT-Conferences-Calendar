'use client';

import type { JSX } from 'react';
import Link from 'next/link';
import { Box, Text, Heading, Flex, Grid, Link as ChakraLink } from '@chakra-ui/react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PageShell from '@/components/PageShell';
import PageMasthead from '@/components/PageMasthead';
import CodeChip from '@/components/CodeChip';
import { inlineLinkStyle } from '@/styles/linkStyles';
import { ROUTES, EXTERNAL_URLS } from '@/constants/routes';

const COLLECTED = [
  {
    title: 'Slack Workspace',
    items: [
      'Slack user ID (for identifying your preferences)',
      'Slack team / workspace ID (for multi-workspace support)',
    ],
  },
  {
    title: 'User Preferences',
    items: [
      'Notification subscription status (enabled / disabled)',
      'When your preferences were created and last updated',
    ],
  },
  {
    title: 'Channel Subscriptions',
    items: [
      'ID and name of each channel the bot is added to',
      'Workspace ID and the Slack user ID of whoever added the bot',
      'When the channel was subscribed',
    ],
  },
  {
    title: 'Workspace Installation',
    items: [
      'The bot OAuth token, used to send messages in your workspace',
      'Workspace name, bot user ID, app ID, granted scopes and install time',
    ],
  },
  {
    title: 'Usage Data',
    items: [
      'Commands run, with your Slack user and workspace IDs (for debugging and improvement)',
      'Error logs, which may include Slack user, channel and workspace IDs and names (never message content or command arguments)',
      'API request timestamps',
    ],
  },
];

const THIRD_PARTY_SERVICES = [
  { name: 'Slack API', use: 'messaging and user authentication', policy: 'https://slack.com/privacy-policy' },
  { name: 'Vercel', use: 'hosting', policy: 'https://vercel.com/legal/privacy-policy' },
  { name: 'Upstash', use: 'database storage', policy: 'https://upstash.com/trust/privacy.pdf' },
];

interface SectionProps {
  num: string;
  title: string;
  children: React.ReactNode;
}

function Section({ num, title, children }: SectionProps): JSX.Element {
  return (
    <Grid
      templateColumns={{ base: '1fr', md: '120px 1fr' }}
      gap={{ base: '3', md: '10' }}
      py={{ base: '8', md: '10' }}
      borderBottom="1px solid"
      borderColor="line.default"
    >
      <Box>
        <Text textStyle="metaLabel" color="brand.400" className="tabular">
          § {num}
        </Text>
      </Box>
      <Box>
        <Heading
          as="h2"
          fontSize={{ base: 'xl', md: '2xl' }}
          fontWeight="600"
          color="brand.500"
          mb="5"
          letterSpacing="-0.01em"
        >
          {title}
        </Heading>
        {children}
      </Box>
    </Grid>
  );
}

function Bullet({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <Flex gap="3" align="flex-start" mb="2.5">
      <Box w="14px" mt="9px" h="1px" bg="brand.400" flexShrink={0} />
      <Text fontSize="sm" color="gray.700" lineHeight="1.7" flex="1">
        {children}
      </Text>
    </Flex>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <>
      <Header />
      <PageShell maxW="960px">
        <ChakraLink
          asChild
          display="inline-flex"
          alignItems="center"
          gap="2"
          mb="10"
          {...inlineLinkStyle}
          textStyle="subhead"
          fontWeight="600"
        >
          <Link href={ROUTES.slackInstall}>
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back to Slack Installation
          </Link>
        </ChakraLink>

        <PageMasthead
          eyebrow="LiGHT · Slack Bot"
          title="Privacy Policy"
          description="How the LiGHT Events Radar Slack bot collects, uses, and protects your information."
          mb="0"
          trailing={
            <Text textStyle="metaLabel" color="brand.400" className="tabular" whiteSpace="nowrap">
              Updated 5 Oct 2026
            </Text>
          }
        />

        {/* Intro */}
        <Box py={{ base: '8', md: '10' }} borderBottom="1px solid" borderColor="line.default">
          <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.700" lineHeight="1.65">
            The LiGHT Events Radar Slack bot (&ldquo;the Bot&rdquo;) is operated by LiGHT Laboratory.
            This Privacy Policy explains how we collect, use, and protect your information when
            you use our Slack bot to receive deadline notifications and search conferences
            and events.
          </Text>
        </Box>

        <Section num="01" title="Information we collect">
          {COLLECTED.map(({ title, items }, index) => (
            <Box key={title} mb={index < COLLECTED.length - 1 ? '6' : undefined}>
              <Text textStyle="subhead" color="brand.500" mb="3">
                {title}
              </Text>
              {items.map((item) => (
                <Bullet key={item}>{item}</Bullet>
              ))}
            </Box>
          ))}
        </Section>

        <Section num="02" title="How we use your information">
          <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
            We use the collected information to:
          </Text>
          <Bullet>Send conference deadline reminders by direct message to users who subscribe</Bullet>
          <Bullet>Maintain your subscription and notification settings</Bullet>
          <Bullet>Post deadline reminders to subscribed channels</Bullet>
          <Bullet>Improve the bot&rsquo;s functionality and user experience</Bullet>
          <Bullet>Debug issues and ensure service reliability</Bullet>
        </Section>

        <Section num="03" title="Data storage & security">
          <Bullet>All user preferences are stored in an Upstash Redis database, and every connection to it is encrypted in transit (TLS).</Bullet>
          <Bullet>Workspace OAuth tokens are stored in the same database.</Bullet>
          <Bullet>All communications with the Slack API are encrypted via HTTPS.</Bullet>
          <Bullet>Access to the database is restricted and authenticated.</Bullet>
          <Bullet>We do not sell, trade, or share your personal information with third parties.</Bullet>
        </Section>

        <Section num="04" title="Data retention">
          <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
            When your workspace uninstalls the bot or revokes its access, the workspace&rsquo;s
            OAuth token, workspace details and channel subscriptions are deleted{' '}
            <Text as="span" fontWeight="600" color="brand.500">immediately</Text>, and direct
            message reminders are switched off for its users.
          </Text>
          <Text fontSize="sm" color="gray.700" lineHeight="1.7">
            Your notification preferences are retained after you unsubscribe or your workspace
            uninstalls the bot, so your settings are preserved if you choose to resubscribe. You
            can request their permanent deletion at any time by contacting us (see &ldquo;Your
            rights&rdquo; below).
          </Text>
        </Section>

        <Section num="05" title="Your rights">
          <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
            You have the right to:
          </Text>
          <Bullet>
            Access your stored preferences using{' '}
            <CodeChip inline>/conf-settings</CodeChip>
          </Bullet>
          <Bullet>Modify your notification preferences at any time</Bullet>
          <Bullet>
            Unsubscribe from notifications using{' '}
            <CodeChip inline>/conf-unsubscribe</CodeChip>
          </Bullet>
          <Bullet>Have workspace data (token, workspace details and channel subscriptions) deleted automatically by uninstalling the bot</Bullet>
          <Bullet>Contact us to request a complete data export, or permanent deletion of your notification preferences</Bullet>
        </Section>

        <Section num="06" title="Third-party services">
          <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
            This bot uses the following third-party services:
          </Text>
          {THIRD_PARTY_SERVICES.map(({ name, use, policy }) => (
            <Bullet key={name}>
              <Text as="span" fontWeight="600" color="brand.500">{name}</Text>: {use}.{' '}
              <ChakraLink href={policy} target="_blank" rel="noopener noreferrer" {...inlineLinkStyle} display="inline-flex" alignItems="center" gap="1">
                Privacy policy <ArrowUpRight size={11} strokeWidth={2} />
              </ChakraLink>
            </Bullet>
          ))}
          <Bullet>
            <Text as="span" fontWeight="600" color="brand.500">GitHub Pages</Text>: fetching public conference data (no personal data shared).
          </Bullet>
        </Section>

        <Section num="07" title="Conference data">
          <Text fontSize="sm" color="gray.700" lineHeight="1.7">
            Conference deadline information is sourced from a publicly maintained YAML file
            hosted on our website. This data contains no personal information and is freely
            accessible to anyone. We do not track which specific conferences you view or
            search for.
          </Text>
        </Section>

        <Section num="08" title="Changes to this policy">
          <Text fontSize="sm" color="gray.700" lineHeight="1.7">
            We may update this Privacy Policy from time to time. The &ldquo;Updated&rdquo; date at the
            top indicates when the policy was last revised. Continued use of the bot after
            changes constitutes acceptance of the updated policy.
          </Text>
        </Section>

        {/* Contact + consent block */}
        <Grid templateColumns={{ base: '1fr', md: '1fr 1fr' }} gap="0" mt="6">
          <Box
            p={{ base: '6', md: '8' }}
            border="1px solid"
            borderColor="line.default"
            borderRight={{ base: '1px solid', md: 'none' }}
            borderBottom={{ base: 'none', md: '1px solid' }}
          >
            <Text textStyle="metaLabel" color="brand.400" mb="4">
              Contact us
            </Text>
            <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
              Questions or concerns about this policy?
            </Text>
            <Flex direction="column" gap="2.5">
              <ChakraLink
                href="mailto:omarziyad.azgaoui2005@gmail.com"
                fontSize="sm"
                display="inline-flex"
                alignItems="center"
                gap="1.5"
                {...inlineLinkStyle}
                alignSelf="flex-start"
              >
                omarziyad.azgaoui2005@gmail.com
              </ChakraLink>
              <ChakraLink
                href={EXTERNAL_URLS.repo}
                target="_blank"
                rel="noopener noreferrer"
                fontSize="sm"
                display="inline-flex"
                alignItems="center"
                gap="1.5"
                {...inlineLinkStyle}
                alignSelf="flex-start"
              >
                {EXTERNAL_URLS.repo.replace('https://', '')}
                <ArrowUpRight size={12} strokeWidth={2} />
              </ChakraLink>
            </Flex>
          </Box>

          <Box
            p={{ base: '6', md: '8' }}
            bg="brand.50"
            border="1px solid"
            borderColor="brand.300"
          >
            <Text textStyle="metaLabel" color="brand.500" mb="4">
              Consent
            </Text>
            <Text fontSize="sm" color="brand.700" fontWeight="500" lineHeight="1.7">
              By installing and using the LiGHT Events Radar Slack bot, you acknowledge that you
              have read and understood this Privacy Policy and consent to the collection, use,
              and storage of your information as described herein.
            </Text>
          </Box>
        </Grid>
      </PageShell>
      <Footer />
    </>
  );
}
