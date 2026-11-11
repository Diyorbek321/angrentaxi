/**
 * web-manager (dispetcher paneli) — Tailwind konfiguratsiyasi.
 *
 * Barcha tokenlar `tailwind.preset.js` da (4 panel uchun yagona, sync
 * qilinadi). Bu yerda faqat `content` va panelga xos qo'shimchalar.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  presets: [require('./tailwind.preset.js')],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
};
