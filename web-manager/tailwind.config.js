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
        // Deliberate human intervention only. Mint = the system is driving,
        // amber = a person stepped in. Keep these visually far apart.
        override: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#B45309',
        },
        danger: {
          DEFAULT: '#EF4444',
          dark: '#B91C1C',
        },
        info: {
          DEFAULT: '#3B82F6',
          dark: '#1D4ED8',
        },
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
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(239,68,68,0.55)' },
          '70%': { boxShadow: '0 0 0 8px rgba(239,68,68,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
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
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slide-up 0.18s ease-out',
      },
    },
  },
  plugins: [],
};
