import { useState, useEffect } from 'react';
import { DateTime } from 'luxon';
import { Flex, Text } from '@chakra-ui/react';

interface CountdownProps {
  deadline: DateTime;
  label: string;
}

interface TimeLeft {
  days?: number;
  hours?: number;
  minutes?: number;
  seconds?: number;
  expired: boolean;
}

export default function Countdown({ deadline, label }: CountdownProps): JSX.Element {
  const calculateTimeLeft = (): TimeLeft => {
    const now = DateTime.now();
    const diff = deadline.diff(now, ['days', 'hours', 'minutes', 'seconds']);

    if (diff.toMillis() <= 0) {
      return { expired: true };
    }

    return {
      days: Math.floor(diff.days),
      hours: Math.floor(diff.hours),
      minutes: Math.floor(diff.minutes),
      seconds: Math.floor(diff.seconds),
      expired: false,
    };
  };

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [deadline]);

  if (timeLeft.expired) {
    return (
      <Text fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="0.14em" fontWeight="500">
        Passed
      </Text>
    );
  }

  const pad = (n?: number) => String(n ?? 0).padStart(2, '0');

  return (
    <Flex direction="column" gap="0.5">
      {label && (
        <Text
          fontSize="10px"
          fontWeight="600"
          color="brand.400"
          textTransform="uppercase"
          letterSpacing="0.2em"
        >
          {label}
        </Text>
      )}
      <Flex gap="1" align="baseline" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {(timeLeft.days ?? 0) > 0 && (
          <Text fontSize="sm" color="brand.500" fontWeight="600">
            {timeLeft.days}<Text as="span" color="brand.400" fontWeight="400">d</Text>
          </Text>
        )}
        <Text fontSize="sm" color="brand.500" fontWeight="600">
          {pad(timeLeft.hours)}<Text as="span" color="brand.400" fontWeight="400">h</Text>
        </Text>
        <Text fontSize="sm" color="brand.500" fontWeight="600">
          {pad(timeLeft.minutes)}<Text as="span" color="brand.400" fontWeight="400">m</Text>
        </Text>
        <Text fontSize="sm" color="brand.400" fontWeight="400">
          {pad(timeLeft.seconds)}s
        </Text>
      </Flex>
    </Flex>
  );
}
