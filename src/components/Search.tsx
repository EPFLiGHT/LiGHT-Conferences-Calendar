import { Box, Flex, Input, Text } from '@chakra-ui/react';
import { Search as SearchIcon } from 'lucide-react';

interface SearchProps {
  value: string;
  onChange: (value: string) => void;
}

export default function Search({ value, onChange }: SearchProps): JSX.Element {
  return (
    <Box mb="6">
      <Flex
        align="center"
        gap="3"
        borderBottom="1px solid"
        borderColor={value ? 'brand.500' : 'line.strong'}
        transition="border-color 0.2s ease"
        _focusWithin={{ borderColor: 'brand.500' }}
      >
        <SearchIcon size={16} strokeWidth={1.75} color="var(--chakra-colors-brand-400)" />
        <Text textStyle="badgeLabel" color="brand.400">
          Search
        </Text>
        <Input
          type="search"
          placeholder="conference name, organization, keyword..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          variant="outline"
          border="none"
          outline="none"
          bg="transparent"
          flex="1"
          fontSize="md"
          color="brand.500"
          _placeholder={{ color: 'gray.400' }}
          _focus={{ outline: 'none', boxShadow: 'none' }}
          px="0"
        />
      </Flex>
    </Box>
  );
}
