import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SmartLink Git Quiz — Zero-Cost Real-Time Arena',
  description: 'Production real-time Git quiz platform for 200 concurrent students with server-side timing and anti-cheat.',
  keywords: ['Git Quiz', 'SmartLink', 'College Webinar', 'Realtime Quiz', 'Anti-cheat'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background text-text flex flex-col font-sans antialiased selection:bg-git-orange/30 selection:text-white">
        <ErrorBoundary>
          <Header />
          <main className="flex-1 flex flex-col">{children}</main>
          <Footer />
        </ErrorBoundary>
      </body>
    </html>
  );
}
