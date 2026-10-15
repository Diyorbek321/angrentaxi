import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

// Self-hosted (not next/font/google) so the build never depends on a live
// fetch to Google's font CDN at build time.
const manrope = localFont({
  src: [
    { path: '../fonts/manrope-400.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/manrope-500.ttf', weight: '500', style: 'normal' },
    { path: '../fonts/manrope-600.ttf', weight: '600', style: 'normal' },
    { path: '../fonts/manrope-700.ttf', weight: '700', style: 'normal' },
    { path: '../fonts/manrope-800.ttf', weight: '800', style: 'normal' },
  ],
  variable: '--font-manrope',
  display: 'swap',
});

const jetbrainsMono = localFont({
  src: [
    { path: '../fonts/jetbrains-mono-400.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/jetbrains-mono-500.ttf', weight: '500', style: 'normal' },
    { path: '../fonts/jetbrains-mono-600.ttf', weight: '600', style: 'normal' },
  ],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Angren Taxi — Admin Panel',
  description: 'Angren Taxi platformasini boshqarish paneli',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below adds `.dark` to <html>
    // before React hydrates, so the server markup and the live DOM differ by
    // that one class on purpose.
    <html
      lang="uz"
      className={`${manrope.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans bg-bg text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
