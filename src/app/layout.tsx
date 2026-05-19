'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { system } from '@/theme';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const basePath = '';

  return (
    <html lang="en">
      <head>
        <title>Conferences | LiGHT Laboratory</title>
        <link rel="icon" type="image/svg+xml" href={`${basePath}/icons/favicon.svg`} />
        <link
          href="https://api.fontshare.com/v2/css?f[]=chillax@300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#ffffff' }}>
        <ChakraProvider value={system}>
          {children}
        </ChakraProvider>
      </body>
    </html>
  );
}
