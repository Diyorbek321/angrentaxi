/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./pages/**/*.{ts,tsx}','./components/**/*.{ts,tsx}','./app/**/*.{ts,tsx}','./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        brand: {
          yellow: '#FACC15',
          black: '#080D1A',
          dark: '#0D1526',
          surface: '#111827',
          border: 'rgba(255,255,255,0.08)',
        },
        navy: {
          950: '#080D1A',
          900: '#0D1526',
          800: '#111827',
          700: '#1E293B',
          600: '#334155',
        },
        warning: '#F59E0B',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      backgroundImage: {
        'glow-yellow': 'radial-gradient(circle at center, rgba(250,204,21,0.15) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        'stat-gradient-1': 'linear-gradient(135deg, #FACC15 0%, #F59E0B 100%)',
        'stat-gradient-2': 'linear-gradient(135deg, #3B82F6 0%, #6366F1 100%)',
        'stat-gradient-3': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'stat-gradient-4': 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
      },
      boxShadow: {
        'glow-yellow': '0 0 20px rgba(250,204,21,0.25)',
        'glow-yellow-sm': '0 0 10px rgba(250,204,21,0.15)',
        'card': '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(250,204,21,0.2)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'count-up': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pulse-glow': { '0%,100%': { boxShadow: '0 0 10px rgba(250,204,21,0.2)' }, '50%': { boxShadow: '0 0 20px rgba(250,204,21,0.4)' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
