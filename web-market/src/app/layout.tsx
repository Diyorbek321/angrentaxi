import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

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
  title: 'Angren Market — Sotuvchi paneli',
  description: "Angren Market do'konini boshqarish paneli",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the inline script below toggles the `dark`
    // class on <html> before hydration, so the server markup and the DOM React
    // first sees differ by design on this one element. Applying the theme from
    // a component instead would read localStorage during render — one value on
    // the server, another in the browser — which is the mismatch this avoids.
    <html
      lang="uz"
      suppressHydrationWarning
      className={`${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased bg-bg text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
