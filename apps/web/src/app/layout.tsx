import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from './providers';
import { ThemeBootScript } from '@/components/theme-boot-script';
import { ThemeInitializer } from '@/components/theme-initializer';
import './globals.css';

// docs/design-system/04-typography-system.md — Inter across every UI role, JetBrains Mono
// reserved for identifiers (correlation/trace ids, once Trust Center is live).
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'German Job Engine',
  description: 'Job search & matching for the German market',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <ThemeBootScript />
      </head>
      <body>
        <Providers>
          <ThemeInitializer />
          {children}
        </Providers>
      </body>
    </html>
  );
}
