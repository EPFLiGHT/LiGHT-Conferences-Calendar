'use client';

import type { JSX } from 'react';
import { Box, Container, Text, Heading, Flex, Grid, Link as ChakraLink } from '@chakra-ui/react';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { inlineLinkStyle } from '@/styles/linkStyles';
import { ROUTES } from '@/constants/routes';

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
      <Box py={{ base: '10', md: '16' }} minH="calc(100vh - 200px)" bg="white">
        <Container maxW="960px" px={{ base: '4', md: '6' }} mx="auto">
          {/* Back link */}
          <ChakraLink
            as={Link}
            href={ROUTES.slackInstall}
            display="inline-flex"
            alignItems="center"
            gap="2"
            mb="10"
            fontSize="xs"
            color="brand.500"
            fontWeight="600"
            textTransform="uppercase"
            letterSpacing="0.18em"
            borderBottom="1px solid"
            borderColor="line.hover"
            pb="1px"
            transition="all 0.2s ease"
            _hover={{ color: 'brand.700', borderColor: 'brand.700', textDecoration: 'none' }}
          >
            <ArrowLeft size={14} strokeWidth={1.75} />
            Back to Slack Installation
          </ChakraLink>

          {/* Masthead */}
          <Text textStyle="eyebrow" color="brand.400" mb="5">
            LiGHT · Slack Bot
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
            Privacy Policy
          </Heading>

          <Flex
            align="baseline"
            justify="space-between"
            pb="3"
            mb="0"
            borderBottom="1px solid"
            borderColor="line.hover"
            gap="4"
            flexWrap="wrap"
          >
            <Text fontSize="sm" color="gray.600" maxW="640px" lineHeight="1.6">
              How the Conferences Calendar Bot collects, uses, and protects your information.
            </Text>
            <Text textStyle="metaLabel" color="brand.400" className="tabular" whiteSpace="nowrap">
              Updated 2 Jul 2026
            </Text>
          </Flex>

          {/* Intro */}
          <Box py={{ base: '8', md: '10' }} borderBottom="1px solid" borderColor="line.default">
            <Text fontSize={{ base: 'md', md: 'lg' }} color="gray.700" lineHeight="1.65">
              The Conferences Calendar Bot (&ldquo;the Bot&rdquo;) is operated by LiGHT Laboratory.
              This Privacy Policy explains how we collect, use, and protect your information when
              you use our Slack bot to receive conference deadline notifications and search
              academic conferences.
            </Text>
          </Box>

          <Section num="01" title="Information we collect">
            <Box mb="6">
              <Text fontSize="xs" color="brand.500" fontWeight="600" textTransform="uppercase" letterSpacing="0.18em" mb="3">
                Slack Workspace
              </Text>
              <Bullet>Slack user ID (for identifying your preferences)</Bullet>
              <Bullet>Slack team / workspace ID (for multi-workspace support)</Bullet>
              <Bullet>User timezone (for accurate deadline notifications)</Bullet>
              <Bullet>Email address (optional, for unique identification across sessions)</Bullet>
            </Box>

            <Box mb="6">
              <Text fontSize="xs" color="brand.500" fontWeight="600" textTransform="uppercase" letterSpacing="0.18em" mb="3">
                User Preferences
              </Text>
              <Bullet>Notification subscription status (enabled / disabled)</Bullet>
              <Bullet>Selected reminder days (e.g. 30, 7, 3 days before deadlines)</Bullet>
              <Bullet>Subject area preferences (e.g. ML, CV, NLP, Security)</Bullet>
              <Bullet>Last notification timestamp</Bullet>
            </Box>

            <Box mb="6">
              <Text fontSize="xs" color="brand.500" fontWeight="600" textTransform="uppercase" letterSpacing="0.18em" mb="3">
                Channel Subscriptions
              </Text>
              <Bullet>Channel IDs and names where the bot is installed</Bullet>
              <Bullet>Channel subscription preferences</Bullet>
              <Bullet>Last posted timestamps</Bullet>
            </Box>

            <Box>
              <Text fontSize="xs" color="brand.500" fontWeight="600" textTransform="uppercase" letterSpacing="0.18em" mb="3">
                Usage Data
              </Text>
              <Bullet>Commands executed (for debugging and improvement)</Bullet>
              <Bullet>Error logs (without personal information)</Bullet>
              <Bullet>API request timestamps</Bullet>
            </Box>
          </Section>

          <Section num="02" title="How we use your information">
            <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
              We use the collected information to:
            </Text>
            <Bullet>Send personalized conference deadline notifications based on your preferences</Bullet>
            <Bullet>Display deadlines in your local timezone</Bullet>
            <Bullet>Filter conferences by your selected subject areas</Bullet>
            <Bullet>Maintain your subscription and notification settings</Bullet>
            <Bullet>Post deadline reminders to subscribed channels</Bullet>
            <Bullet>Improve the bot&rsquo;s functionality and user experience</Bullet>
            <Bullet>Debug issues and ensure service reliability</Bullet>
          </Section>

          <Section num="03" title="Data storage & security">
            <Bullet>All user preferences are stored securely in a Vercel KV (Redis) database with encryption at rest.</Bullet>
            <Bullet>Workspace OAuth tokens are stored securely in the same encrypted database.</Bullet>
            <Bullet>All communications with the Slack API are encrypted via HTTPS.</Bullet>
            <Bullet>Access to the database is restricted and authenticated.</Bullet>
            <Bullet>We do not sell, trade, or share your personal information with third parties.</Bullet>
          </Section>

          <Section num="04" title="Data retention">
            <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
              When your workspace uninstalls the bot, workspace data (OAuth tokens, workspace
              details, and channel subscriptions) is deleted{' '}
              <Text as="span" fontWeight="600" color="brand.500">immediately</Text>.
            </Text>
            <Text fontSize="sm" color="gray.700" lineHeight="1.7">
              Your personal notification preferences are retained after you unsubscribe, so your
              settings are preserved if you choose to resubscribe. You can request their permanent
              deletion at any time by contacting us (see &ldquo;Your rights&rdquo; below).
            </Text>
          </Section>

          <Section num="05" title="Your rights">
            <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
              You have the right to:
            </Text>
            <Bullet>
              Access your stored preferences using{' '}
              <Text as="code" px="2" py="0.5" fontSize="xs" fontFamily="mono" color="brand.500" border="1px solid" borderColor="line.strong" borderRadius="control" className="tabular">
                /conf-settings
              </Text>
            </Bullet>
            <Bullet>Modify your notification preferences at any time</Bullet>
            <Bullet>
              Unsubscribe from notifications using{' '}
              <Text as="code" px="2" py="0.5" fontSize="xs" fontFamily="mono" color="brand.500" border="1px solid" borderColor="line.strong" borderRadius="control" className="tabular">
                /conf-unsubscribe
              </Text>
            </Bullet>
            <Bullet>Have workspace data (tokens and channel subscriptions) deleted automatically by uninstalling the bot</Bullet>
            <Bullet>Contact us to request a complete data export, or permanent deletion of your notification preferences</Bullet>
          </Section>

          <Section num="06" title="Third-party services">
            <Text fontSize="sm" color="gray.700" lineHeight="1.7" mb="4">
              This bot uses the following third-party services:
            </Text>
            <Bullet>
              <Text as="span" fontWeight="600" color="brand.500">Slack API</Text>: messaging and user authentication.{' '}
              <ChakraLink href="https://slack.com/privacy-policy" target="_blank" rel="noopener noreferrer" {...inlineLinkStyle} display="inline-flex" alignItems="center" gap="1">
                Privacy policy <ArrowUpRight size={11} strokeWidth={2} />
              </ChakraLink>
            </Bullet>
            <Bullet>
              <Text as="span" fontWeight="600" color="brand.500">Vercel</Text>: hosting and database storage.{' '}
              <ChakraLink href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" {...inlineLinkStyle} display="inline-flex" alignItems="center" gap="1">
                Privacy policy <ArrowUpRight size={11} strokeWidth={2} />
              </ChakraLink>
            </Bullet>
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
                  href="https://github.com/EPFLiGHT/Conferences-Calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  fontSize="sm"
                  display="inline-flex"
                  alignItems="center"
                  gap="1.5"
                  {...inlineLinkStyle}
                  alignSelf="flex-start"
                >
                  github.com/EPFLiGHT/Conferences-Calendar
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
                By installing and using the Conferences Calendar Bot, you acknowledge that you
                have read and understood this Privacy Policy and consent to the collection, use,
                and storage of your information as described herein.
              </Text>
            </Box>
          </Grid>
        </Container>
      </Box>
      <Footer />
    </>
  );
}
