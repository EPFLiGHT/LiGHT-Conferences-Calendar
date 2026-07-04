import type { JSX } from 'react';
import { Box, Flex, Input, Text } from '@chakra-ui/react';
import { Search as SearchIcon, X } from 'lucide-react';

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
          onKeyDown={(e) => {
            if (e.key === 'Escape' && value) {
              e.preventDefault();
              onChange('');
            }
          }}
          aria-label="Search conferences"
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
          css={{
            '&::-webkit-search-cancel-button': {
              WebkitAppearance: 'none',
              display: 'none',
            },
          }}
        />
        {value && (
          <Box
            as="button"
            aria-label="Clear search"
            onClick={() => onChange('')}
            display="flex"
            alignItems="center"
            justifyContent="center"
            p="1"
            borderRadius="badge"
            color="brand.400"
            cursor="pointer"
            transition="all 0.18s ease"
            _hover={{ color: 'brand.700', bg: 'brand.50' }}
          >
            <X size={14} strokeWidth={2} />
          </Box>
        )}
      </Flex>
    </Box>
  );
}
