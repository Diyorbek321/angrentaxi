/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // Theme-dependent tokens. Declared as space-separated RGB channels in
        // globals.css so Tailwind's `/opacity` modifier keeps working
        // (`bg-surface/60`). Never hard-code #hex for these — the same class
        // has to render correctly in light and dark.
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        subtle: 'rgb(var(--ink-subtle) / <alpha-value>)',

        // Brand mint — identical in both themes, sourced from
        // mobile/lib/core/config/app_theme.dart so the panel matches the app.
        primary: {
          DEFAULT: '#1FCA8E',
          dark: '#10A064',
          light: '#27D89B',
          50: '#ECFDF6',
          100: '#D2F8E9',
          200: '#A6F0D3',
          300: '#6FE4B8',
          400: '#27D89B',
          500: '#1FCA8E',
          600: '#10A064',
          700: '#0C7A4D',
          800: '#0A5E3C',
          900: '#083F29',
        },

        // Order lifecycle. `new` deliberately reuses mint: the one status the
        // vendor must not miss is the one painted in the brand colour.
        packing: { DEFAULT: '#3B82F6', dark: '#1D4ED8', light: '#60A5FA' },
        shipped: { DEFAULT: '#8B5CF6', dark: '#6D28D9', light: '#A78BFA' },
        delivered: { DEFAULT: '#0C7A4D', dark: '#0A5E3C', light: '#34D399' },

        // Warning only — low stock, out of stock, cancelled. Never decorative,
        // never "just another colour"; if it is amber or red, something needs
        // the vendor's attention.
        warn: { DEFAULT: '#F59E0B', dark: '#B45309', light: '#FBBF24' },
        danger: { DEFAULT: '#EF4444', dark: '#B91C1C', light: '#F87171' },
        info: { DEFAULT: '#3B82F6', dark: '#1D4ED8' },
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        pop: 'var(--shadow-pop)',
        'glow-mint': '0 0 0 1px rgba(31,202,142,0.25), 0 6px 20px -6px rgba(31,202,142,0.45)',
        'glow-mint-sm': '0 0 12px -2px rgba(31,202,142,0.35)',
      },
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        // Halo on unanswered `new` orders. Mint, not red — it is an
        // opportunity, not a failure.
        'pulse-mint': {
          '0%': { boxShadow: '0 0 0 0 rgba(31,202,142,0.5)' },
          '70%': { boxShadow: '0 0 0 7px rgba(31,202,142,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(31,202,142,0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-up': {
          from: { transform: 'translateY(8px)', opacity: '0' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'pulse-mint': 'pulse-mint 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slide-up 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
