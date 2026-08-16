import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Cairo, IBM_Plex_Sans_Arabic } from 'next/font/google';

const bodyFont = IBM_Plex_Sans_Arabic({ 
  subsets: ['arabic', 'latin'], 
  weight: ['400', '500', '600', '700'], 
  variable: '--font-body', 
  display: 'swap' 
});

const headlineFont = Cairo({ 
  subsets: ['arabic', 'latin'], 
  weight: ['600', '700', '800', '900'], 
  variable: '--font-headline', 
  display: 'swap' 
});

export const metadata: Metadata = {
  title: 'NovaFlow ERP - نظام إدارة هندسي متكامل',
  description: 'نظام ذكاء عمليات تنفيذي لشركات المقاولات والهندسة الحديثة.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" suppressHydrationWarning>
      <body className={`${bodyFont.variable} ${headlineFont.variable} font-body antialiased selection:bg-primary/20`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
