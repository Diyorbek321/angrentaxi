import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { getServerLocale } from '@/lib/i18n/server';
import { t } from '@/locales';

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

export function generateMetadata(): Metadata {
  getServerLocale();
  const m = t();
  return { title: m.meta.title, description: m.meta.description };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getServerLocale();
  return (
    /*
     * `suppressHydrationWarning` — pastdagi skript <html> ga `dark` klassini
     * React hidratsiya qilgunicha qo'yadi. Bu farqni React aks holda
     * "mos kelmadi" deb hisoblardi. Skript bloklab ishlaydi, shuning uchun
     * birinchi bo'yashda tema allaqachon to'g'ri — "oq chaqnash" bo'lmaydi.
     */
    <html lang={locale} className={`${manrope.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
