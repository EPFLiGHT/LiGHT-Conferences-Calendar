/**
 * DeadlineCard Component
 *
 * Displays conference deadline information with countdown timer.
 * Supports two variants: compact (for cards) and detailed (for modals).
 * Shows both original timezone and local timezone, plus countdown or expired state.
 */

import { Box, VStack, Text, Flex } from '@chakra-ui/react';
import { DateTime } from 'luxon';
import Countdown from './Countdown';
import type { DeadlineInfo } from '@/types/conference';

interface DeadlineCardProps {
  deadline: DeadlineInfo;
  timezone: string;
  variant?: 'compact' | 'detailed';
}

export default function DeadlineCard({
  deadline,
  timezone,
  variant = 'compact'
}: DeadlineCardProps): JSX.Element {
  const now = DateTime.now();
  const isExpired = deadline.localDatetime <= now;

  if (variant === 'detailed') {
    const detailDay = deadline.localDatetime.toFormat('dd');
    const detailMonth = deadline.localDatetime.toFormat('MMM yyyy').toUpperCase();

    return (
      <Box
        bg="white"
        border="1px solid"
        borderColor="rgba(46, 95, 168, 0.25)"
      >
        {/* Header */}
        <Flex
          align="center"
          justify="space-between"
          px="5"
          py="3"
          borderBottom="1px solid"
          borderColor="rgba(46, 95, 168, 0.18)"
          bg="brand.50"
        >
          <Text
            fontSize="11px"
            fontWeight="700"
            color="brand.500"
            textTransform="uppercase"
            letterSpacing="0.22em"
          >
            {deadline.label}
          </Text>
          {isExpired && (
            <Text
              fontSize="11px"
              fontWeight="600"
              color="gray.500"
              textTransform="uppercase"
              letterSpacing="0.18em"
            >
              Passed
            </Text>
          )}
        </Flex>

        {/* Body */}
        <Flex gap="5" align="stretch" p="5">
          {/* Big date numeral */}
          <Flex
            direction="column"
            align="flex-start"
            justify="center"
            minW="80px"
            pr="5"
            borderRight="1px solid"
            borderColor="rgba(46, 95, 168, 0.22)"
          >
            <Text
              fontSize="56px"
              lineHeight="0.95"
              fontWeight="500"
              color={isExpired ? 'gray.400' : 'brand.500'}
              letterSpacing="-0.035em"
              className="tabular"
            >
              {detailDay}
            </Text>
            <Text
              fontSize="11px"
              color="brand.400"
              textTransform="uppercase"
              letterSpacing="0.2em"
              fontWeight="600"
              mt="2"
              className="tabular"
            >
              {detailMonth}
            </Text>
          </Flex>

          {/* Times */}
          <VStack align="stretch" gap="4" flex="1" justify="center">
            <VStack align="start" gap="1">
              <Text fontSize="10px" fontWeight="600" color="brand.400" textTransform="uppercase" letterSpacing="0.2em">
                Original time
              </Text>
              <Text fontSize="sm" color="brand.500" fontWeight="500" className="tabular" lineHeight="1.5">
                {deadline.datetime.toFormat('EEEE, MMMM dd, yyyy')}
              </Text>
              <Text fontSize="xs" color="gray.600" className="tabular">
                {deadline.datetime.toFormat('HH:mm')} {timezone}
              </Text>
            </VStack>
            <VStack align="start" gap="1">
              <Text fontSize="10px" fontWeight="600" color="brand.400" textTransform="uppercase" letterSpacing="0.2em">
                Your local time
              </Text>
              <Text fontSize="sm" color="brand.500" fontWeight="500" className="tabular" lineHeight="1.5">
                {deadline.localDatetime.toFormat('EEEE, MMMM dd, yyyy')}
              </Text>
              <Text fontSize="xs" color="gray.600" className="tabular">
                {deadline.localDatetime.toFormat('HH:mm')} {deadline.localDatetime.zoneName}
              </Text>
            </VStack>

            {!isExpired && (
              <Box pt="1" borderTop="1px solid" borderColor="rgba(46, 95, 168, 0.18)">
                <Countdown deadline={deadline.localDatetime} label="Time remaining" />
              </Box>
            )}
          </VStack>
        </Flex>
      </Box>
    );
  }

  const day = deadline.localDatetime.toFormat('dd');
  const monthYear = deadline.localDatetime.toFormat('MMM yyyy').toUpperCase();
  const time = deadline.localDatetime.toFormat('HH:mm');

  return (
    <Flex gap="4" align="stretch">
      {/* Date block */}
      <Flex
        direction="column"
        align="flex-start"
        minW="56px"
        pr="4"
        borderRight="1px solid"
        borderColor="rgba(46, 95, 168, 0.22)"
      >
        <Text
          fontSize="38px"
          lineHeight="0.95"
          fontWeight="500"
          color={isExpired ? 'gray.400' : 'brand.500'}
          letterSpacing="-0.03em"
          className="tabular"
        >
          {day}
        </Text>
        <Text
          fontSize="10px"
          color="brand.400"
          textTransform="uppercase"
          letterSpacing="0.2em"
          fontWeight="600"
          mt="1.5"
          className="tabular"
        >
          {monthYear}
        </Text>
      </Flex>

      {/* Detail */}
      <VStack align="stretch" gap="1.5" flex="1" justify="center">
        <Text
          fontSize="10px"
          fontWeight="600"
          color="brand.500"
          textTransform="uppercase"
          letterSpacing="0.2em"
        >
          {deadline.label}
        </Text>
        <Text fontSize="xs" color="gray.600" className="tabular" lineHeight="1.5">
          {time} {timezone}
        </Text>
        {isExpired ? (
          <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="0.14em" fontWeight="500">
            Passed
          </Text>
        ) : (
          <Box className="tabular">
            <Countdown deadline={deadline.localDatetime} label="" />
          </Box>
        )}
      </VStack>
    </Flex>
  );
}
