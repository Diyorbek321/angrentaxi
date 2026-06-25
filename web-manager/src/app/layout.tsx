import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Angren Taxi — Dispatcher Panel',
  description: 'Real-time order management and dispatch for Angren Taxi',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-900 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
