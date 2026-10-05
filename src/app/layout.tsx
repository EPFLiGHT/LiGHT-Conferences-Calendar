import { Providers } from './providers';

export const metadata = {
  title: 'LiGHT Events Radar',
  description:
    'Discover conferences and events in global health, humanitarian response and AI. Track key dates and submission deadlines to find where you can contribute, present and engage.',
  icons: { icon: '/icons/favicon.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning style={{ overflowX: 'clip' }}>
      <head>
        {/* Manrope = body, Playfair Display = headings (Ivy Presto Headline stand-in). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, overflowX: 'clip' }} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
