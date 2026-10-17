import type { Metadata, Viewport } from 'next';

import { ServiceWorker } from '@/components/service-worker';
import { Toaster } from '@/components/ui/sonner';

import './globals.css';

export const metadata: Metadata = {
  title: { default: 'SetStack', template: '%s · SetStack' },
  description: 'A personal workout log.',
  applicationName: 'SetStack',
  appleWebApp: {
    capable: true,
    title: 'SetStack',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
        <ServiceWorker />
      </body>
    </html>
  );
}
