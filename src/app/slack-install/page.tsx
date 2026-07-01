'use client';

import { Box, Container, Flex, Text, Heading, Grid, Image, Link as ChakraLink } from '@chakra-ui/react';
import { Bell, Search, SlidersHorizontal } from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { COMMAND_DESCRIPTIONS } from '@/slack-bot/config/constants';
import { ROUTES, EXTERNAL_URLS } from '@/constants/routes';
import Link from 'next/link';

/**
 * Slack Bot Installation Landing Page
 * Displays an "Add to Slack" button for OAuth installation
 */
export default function SlackInstallPage() {
  const features = [
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
      title: 'Customizable',
      description: 'Filter by subjects: ML, CV, NLP, Security, and more.',
    },
  ];

  return (
    <>
      <Header />
      <Box py={{ base: '12', md: '20' }} minH="calc(100vh - 200px)" bg="white">
        <Container maxW="960px" px={{ base: '4', md: '6' }} mx="auto">
          {/* Eyebrow */}
          <Text
            fontSize="11px"
            color="brand.400"
            textTransform="uppercase"
            letterSpacing="0.22em"
            fontWeight="600"
            textAlign="center"
            mb="6"
          >
            LiGHT · Slack Integration
          </Text>

          {/* Hero */}
          <Box textAlign="center" mb="14">
            <Flex justify="center" mb="8">
              <Image
                src="/slack-bot-logo.png"
                alt="Conferences Calendar Slack Bot"
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
              Conferences Calendar Bot
            </Heading>

            <Text
              fontSize={{ base: 'md', md: 'lg' }}
              color="gray.600"
              maxW="2xl"
              mx="auto"
              lineHeight="1.6"
              mb="10"
            >
              Get smart reminders for upcoming deadlines, search conferences by topic,
              and customize notifications for your research areas, straight from Slack.
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

            <Text
              fontSize="11px"
              color="brand.400"
              textTransform="uppercase"
              letterSpacing="0.2em"
              fontWeight="500"
            >
              Free for all Slack workspaces
            </Text>

            <Text fontSize="xs" color="gray.500" mt="3">
              By installing, you agree to our{' '}
              <ChakraLink
                as={Link}
                href={ROUTES.slackPrivacy}
                color="brand.500"
                fontWeight="600"
                borderBottom="1px solid"
                borderColor="brand.500"
                pb="0.5"
                transition="all 0.2s ease"
                _hover={{ color: 'brand.700', borderColor: 'brand.700', textDecoration: 'none' }}
              >
                Privacy Policy
              </ChakraLink>
            </Text>
          </Box>

          {/* Section rule */}
          <Flex
            align="baseline"
            justify="space-between"
            mb="6"
            pb="3"
            borderBottom="1px solid"
            borderColor="line.default"
          >
            <Text
              fontSize="11px"
              color="brand.500"
              textTransform="uppercase"
              letterSpacing="0.22em"
              fontWeight="600"
            >
              What you get
            </Text>
            <Text
              fontSize="11px"
              color="brand.400"
              textTransform="uppercase"
              letterSpacing="0.22em"
              fontWeight="600"
              className="tabular"
            >
              01 / 02
            </Text>
          </Flex>

          {/* Features Grid */}
          <Grid templateColumns={{ base: '1fr', md: 'repeat(3, 1fr)' }} gap="0" mb="16">
            {features.map(({ Icon, title, description }, index) => (
              <Box
                key={title}
                p="6"
                borderTop={{ base: '1px solid', md: 'none' }}
                borderBottom={{ base: index === features.length - 1 ? '1px solid' : 'none', md: 'none' }}
                borderRight={{ base: 'none', md: index < features.length - 1 ? '1px solid' : 'none' }}
                borderColor="line.default"
              >
                <Icon size={20} strokeWidth={1.5} color="var(--chakra-colors-brand-500)" />
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

          {/* Section rule */}
          <Flex
            align="baseline"
            justify="space-between"
            mb="6"
            pb="3"
            borderBottom="1px solid"
            borderColor="line.default"
          >
            <Text
              fontSize="11px"
              color="brand.500"
              textTransform="uppercase"
              letterSpacing="0.22em"
              fontWeight="600"
            >
              Available commands
            </Text>
            <Text
              fontSize="11px"
              color="brand.400"
              textTransform="uppercase"
              letterSpacing="0.22em"
              fontWeight="600"
              className="tabular"
            >
              02 / 02
            </Text>
          </Flex>

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
                    {cmd}
                  </Box>
                  <Text fontSize="sm" color="gray.600" flex="1" lineHeight="1.5">
                    {desc}
                  </Text>
                </Flex>
              );
            })}
          </Grid>

        </Container>
      </Box>
      <Footer />
    </>
  );
}
