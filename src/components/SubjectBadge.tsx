import { Flex, FlexProps, Text } from '@chakra-ui/react';
import InfoTooltip from './InfoTooltip';
import { getSubjectsArray } from '@/utils/parser';
import { SUBJECT_LABELS } from '@/constants/subjects';

interface SubjectBadgeProps extends Omit<FlexProps, 'children'> {
  subjects: string | string[];
}

export default function SubjectBadge({
  subjects,
  gap = '2',
  wrap = 'wrap',
  ...flexProps
}: SubjectBadgeProps): JSX.Element | null {
  const normalizedSubjects = getSubjectsArray(subjects);

  if (normalizedSubjects.length === 0) return null;

  return (
    <Flex gap={gap} wrap={wrap} {...flexProps}>
      {normalizedSubjects.map((subject) => (
        <InfoTooltip key={subject} label={SUBJECT_LABELS[subject] || subject}>
          <Text
            as="span"
            fontSize="10px"
            fontWeight="700"
            color="brand.400"
            textTransform="uppercase"
            letterSpacing="0.2em"
            whiteSpace="nowrap"
            cursor="help"
            borderBottom="1px solid"
            borderColor="rgba(12, 67, 160, 0.3)"
            pb="1px"
          >
            {subject}
          </Text>
        </InfoTooltip>
      ))}
    </Flex>
  );
}
