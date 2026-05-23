import { Providers } from './providers';

export const metadata = {
  title: 'Conferences | LiGHT Laboratory',
  icons: { icon: '/icons/favicon.svg' },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://api.fontshare.com/v2/css?f[]=chillax@300,400,500,600,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, padding: 0, background: '#ffffff' }} suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
