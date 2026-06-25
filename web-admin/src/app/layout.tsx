import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'Angren Taxi — Admin Panel',
  description: 'Angren Taxi platformasini boshqarish paneli',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
