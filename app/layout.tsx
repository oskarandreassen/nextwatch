import './globals.css';
import type { Metadata } from 'next';
import React from 'react';
import AppShell from './components/layouts/AppShell';

export const metadata: Metadata = {
  title: 'NextWatch',
  description: 'Swipe your next watch',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
