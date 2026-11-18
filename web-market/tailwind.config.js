/**
 * web-market — Tailwind konfiguratsiyasi.
 *
 * Barcha tokenlar `tailwind.preset.js` da (web-manager'dan sync qilinadi —
 * scripts/sync-panel-ui.sh). Bu yerda faqat `content` va panelga xos
 * qo'shimchalar.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  presets: [require('./tailwind.preset.js')],
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
  ],
};
