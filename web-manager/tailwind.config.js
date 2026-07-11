/** @type {import('tailwindcss').Config} */
module.exports = {
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
        warning: '#F59E0B',
        accent: {
          DEFAULT: '#FACC15',
          50: '#FEFCE8',
          100: '#FEF9C3',
          200: '#FEF08A',
          300: '#FDE047',
          400: '#FACC15',
          500: '#FACC15',
          600: '#CA8A04',
          700: '#A16207',
          800: '#854D0E',
          900: '#713F12',
        },
        brand: {
          yellow: '#FACC15',
          black: '#080D1A',
          dark: '#0D1526',
          surface: '#111827',
        },
        navy: {
          950: '#080D1A',
          900: '#0D1526',
          800: '#111827',
          700: '#1E293B',
          600: '#334155',
        },
      },
      boxShadow: {
        'glow-yellow': '0 0 20px rgba(250,204,21,0.25)',
        'glow-yellow-sm': '0 0 10px rgba(250,204,21,0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
