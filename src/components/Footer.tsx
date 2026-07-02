'use client';

import { Box, Container, Flex, Grid, Heading, Text, Link, Image } from '@chakra-ui/react';
import { MapPin, Mail, Linkedin, Github, ArrowUpRight, ArrowUp } from 'lucide-react';
import { ROUTES } from '@/constants/routes';
import { inlineLinkStyle } from '@/styles/linkStyles';

const colHeadStyle = {
  textStyle: 'eyebrow',
  color: 'brand.500',
  mb: '2',
  pb: '3',
  borderBottom: '1px solid',
  borderColor: 'line.strong',
};

export default function Footer(): JSX.Element {
  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <Box as="footer" mt="auto" position="relative">
      {/* Top accent rule */}
      <Box position="relative" h="3px" overflow="hidden" bg="line.subtle">
        <Box
          position="absolute"
          top="0"
          left="0"
          h="100%"
          w="38%"
          bgGradient="to-r"
          gradientFrom="brand.500"
          gradientTo="brand.400"
        />
      </Box>

      <Box
        bg="brand.50"
        bgGradient="to-b"
        gradientFrom="white"
        gradientTo="brand.50"
        pt={{ base: '14', md: '20' }}
        pb={{ base: '8', md: '10' }}
        borderBottom="1px solid"
        borderColor="brand.500"
      >
        <Container maxW="1200px" px={{ base: '4', md: '6' }} mx="auto">
          {/* Masthead colophon */}
          <Flex
            align="baseline"
            justify="space-between"
            mb={{ base: '10', md: '14' }}
            pb="4"
            borderBottom="2px solid"
            borderColor="brand.500"
            gap="4"
            flexWrap="wrap"
          >
            <Text
              fontSize={{ base: '11px', md: '12px' }}
              color="brand.500"
              textTransform="uppercase"
              letterSpacing="0.28em"
              fontWeight="700"
            >
              LiGHT Laboratory
            </Text>
            <Text
              fontSize="11px"
              color="brand.400"
              textTransform="uppercase"
              letterSpacing="0.24em"
              fontWeight="600"
              className="tabular"
            >
              EPFL
            </Text>
          </Flex>

          {/* Main grid */}
          <Grid
            templateColumns={{ base: '1fr', lg: '1.4fr 1fr 1fr' }}
            gap={{ base: '12', lg: '14' }}
            mb={{ base: '12', md: '14' }}
          >
            {/* Banner block */}
            <Box>
              <Box position="relative" mb="8" pb="3" pr="3">
                {/* Offset accent block in lighter brand blue */}
                <Box
                  position="absolute"
                  top="10px"
                  left="10px"
                  right="0"
                  bottom="0"
                  bg="brand.400"
                  zIndex="0"
                />

                {/* Banner card */}
                <Link
                  href="https://www.light-laboratory.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  position="relative"
                  zIndex="1"
                  display="block"
                  border="1px solid"
                  borderColor="brand.500"
                  overflow="hidden"
                  bg="brand.500"
                  transition="transform 0.25s ease"
                  _hover={{ transform: 'translate(-3px, -3px)' }}
                >
                  <Image
                    src="/light-banner-new.png"
                    alt="LiGHT Laboratory"
                    w="100%"
                    h="auto"
                    objectFit="cover"
                    display="block"
                  />
                </Link>

                {/* Corner crop marks */}
                <Box
                  position="absolute"
                  top="-6px"
                  left="-6px"
                  zIndex="2"
                  w="14px"
                  h="14px"
                  borderTop="2px solid"
                  borderLeft="2px solid"
                  borderColor="brand.500"
                />
                <Box
                  position="absolute"
                  bottom="-3px"
                  right="-3px"
                  zIndex="2"
                  w="14px"
                  h="14px"
                  borderBottom="2px solid"
                  borderRight="2px solid"
                  borderColor="brand.500"
                />
              </Box>

              <Heading
                as="p"
                fontSize={{ base: '2xl', md: '3xl' }}
                fontWeight="600"
                color="brand.500"
                letterSpacing="-0.02em"
                lineHeight="1.1"
                mb="3"
                mt="2"
              >
                Laboratory for Intelligent Global Health
                <Text as="span" color="brand.400">{' '}&amp; Humanitarian Response Technologies.</Text>
              </Heading>

              <Text fontSize="sm" color="gray.600" lineHeight="1.65" maxW="440px" mb="6">
                Building open tools for research that matters, from conference deadlines to
                clinical decision support.
              </Text>

              <Link
                href="https://www.light-laboratory.org/"
                target="_blank"
                rel="noopener noreferrer"
                display="inline-flex"
                alignItems="center"
                gap="2"
                fontSize="sm"
                {...inlineLinkStyle}
                fontWeight="600"
              >
                Visit the lab
                <ArrowUpRight size={15} strokeWidth={2} />
              </Link>
            </Box>

            {/* Contact block */}
            <Box>
              <Text {...colHeadStyle}>Contact</Text>

              <Flex direction="column" gap="6" mt="6">
                <Box>
                  <Flex align="center" gap="2" mb="2">
                    <MapPin size={14} strokeWidth={1.75} color="var(--chakra-colors-brand-500)" />
                    <Text fontSize="xs" fontWeight="700" color="brand.500" textTransform="uppercase" letterSpacing="0.16em">
                      Location
                    </Text>
                  </Flex>
                  <Text fontSize="sm" color="gray.700" lineHeight="1.6">
                    EPFL · Lausanne, Switzerland
                  </Text>
                </Box>

                <Box>
                  <Flex align="center" gap="2" mb="2">
                    <Mail size={14} strokeWidth={1.75} color="var(--chakra-colors-brand-500)" />
                    <Text fontSize="xs" fontWeight="700" color="brand.500" textTransform="uppercase" letterSpacing="0.16em">
                      Email
                    </Text>
                  </Flex>
                  <Link
                    href="mailto:mary-anne.hartley@epfl.ch"
                    fontSize="sm"
                    {...inlineLinkStyle}
                  >
                    mary-anne.hartley@epfl.ch
                  </Link>
                </Box>

                <Box>
                  <Flex align="center" gap="2" mb="2">
                    <Linkedin size={14} strokeWidth={1.75} color="var(--chakra-colors-brand-500)" />
                    <Text fontSize="xs" fontWeight="700" color="brand.500" textTransform="uppercase" letterSpacing="0.16em">
                      LinkedIn
                    </Text>
                  </Flex>
                  <Link
                    href="https://www.linkedin.com/company/light-laboratory/"
                    target="_blank"
                    rel="noopener noreferrer"
                    fontSize="sm"
                    display="inline-flex"
                    alignItems="center"
                    gap="1"
                    {...inlineLinkStyle}
                  >
                    LiGHT Laboratory
                    <ArrowUpRight size={12} strokeWidth={2} />
                  </Link>
                </Box>
              </Flex>
            </Box>

            {/* Project block */}
            <Box>
              <Text {...colHeadStyle}>This Project</Text>

              <Flex direction="column" gap="3.5" mt="6">
                <Link
                  href="https://github.com/EPFLiGHT/Conferences-Calendar"
                  target="_blank"
                  rel="noopener noreferrer"
                  fontSize="sm"
                  display="inline-flex"
                  alignItems="center"
                  gap="2"
                  alignSelf="flex-start"
                  {...inlineLinkStyle}
                >
                  <Github size={14} strokeWidth={1.75} />
                  Contribute on GitHub
                  <ArrowUpRight size={12} strokeWidth={2} />
                </Link>

                <Link
                  href={ROUTES.slackInstall}
                  fontSize="sm"
                  alignSelf="flex-start"
                  {...inlineLinkStyle}
                >
                  Add the Slack bot →
                </Link>

                <Link
                  href={ROUTES.slackPrivacy}
                  fontSize="sm"
                  alignSelf="flex-start"
                  {...inlineLinkStyle}
                >
                  Privacy policy
                </Link>
              </Flex>

              {/* Credits card */}
              <Box
                mt="8"
                p="5"
                bg="white"
                border="1px solid"
                borderColor="line.strong"
                position="relative"
              >
                <Box
                  position="absolute"
                  top="-1px"
                  left="-1px"
                  w="24px"
                  h="3px"
                  bg="brand.500"
                />
                <Text textStyle="badgeLabel" color="brand.400" mb="2">
                  Credits
                </Text>
                <Text fontSize="sm" color="gray.700" lineHeight="1.6">
                  Built by{' '}
                  <Link
                    href="https://github.com/AZOGOAT"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...inlineLinkStyle}
                    fontWeight="600"
                  >
                    AZO
                  </Link>
                  {' '}from the{' '}
                  <Link
                    href="https://github.com/EPFLiGHT"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...inlineLinkStyle}
                    fontWeight="600"
                  >
                    LiGHT Lab
                  </Link>
                  .
                </Text>
              </Box>
            </Box>
          </Grid>

          {/* Bottom bar */}
          <Flex
            align="center"
            justify="space-between"
            pt="6"
            borderTop="1px solid"
            borderColor="line.strong"
            gap="4"
            flexWrap="wrap"
          >
            <Text textStyle="metaLabel" color="brand.500" className="tabular">
              © {new Date().getFullYear()} LiGHT Laboratory · All rights reserved
            </Text>
            <Flex gap="6" align="center">
              <Link
                href="https://github.com/EPFLiGHT/Conferences-Calendar"
                target="_blank"
                rel="noopener noreferrer"
                textStyle="metaLabel"
                {...inlineLinkStyle}
                fontWeight="600"
              >
                Source
              </Link>
              <Box
                as="button"
                onClick={scrollTop}
                aria-label="Back to top"
                display="inline-flex"
                alignItems="center"
                gap="1.5"
                textStyle="metaLabel"
                color="brand.500"
                border="1px solid"
                borderColor="brand.500"
                px="3"
                py="1.5"
                cursor="pointer"
                transition="all 0.2s ease"
                _hover={{ bg: 'brand.500', color: 'white' }}
              >
                Top
                <ArrowUp size={11} strokeWidth={2} />
              </Box>
            </Flex>
          </Flex>
        </Container>
      </Box>
    </Box>
  );
}
