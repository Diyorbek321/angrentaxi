// AUTO-SYNCED from web-manager — edit there, then run scripts/sync-panel-ui.sh
/**
 * Angren Mint Design System — 4 ta web panel uchun yagona Tailwind preset.
 *
 * Ranglar: docs/DESIGN-TOKENS.md (muzlatilgan).
 * Panel zichlik qatlami (radius, soya, tipografika og'irligi):
 * docs/design/PANEL-UI-KIT.md §2. CSS o'zgaruvchilari: src/styles/tokens.css.
 *
 * Panel tailwind.config.js:
 *   module.exports = { presets: [require('./tailwind.preset.js')], content: [...] }
 *
 * ⚠️ IKKI QATLAM:
 *   `bg-primary` + `text-white`   → tugma, faol toggle, interaktiv fon
 *   `bg-mint`    + `text-mint-on` → chip, badge, dekorativ to'ldirish
 *   `bg-mint-deep`                → yorug' fonda ko'rinishi shart mint indikator
 *   `override` (amber)            → FAQAT qo'lda aralashuv
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: 'class',
  content: [],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Faqat ID, davlat raqami, SKU, kod. Pul/son/vaqt — `.num` (sans + tabular).
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },

      // Panel shkalasi: micro 11 / caption 12 / table 13 / body 14 / title 15 /
      // h3 16 / h2 18 / h1 20 / kpi 24 / display 28. Sarlavhalar 600.
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em', fontWeight: '600' }], // 11
        caption: ['0.75rem', { lineHeight: '1rem' }], // 12
        table: ['0.8125rem', { lineHeight: '1.25rem' }], // 13
        label: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }], // 13
        body: ['0.875rem', { lineHeight: '1.25rem' }], // 14
        'body-lg': ['0.9375rem', { lineHeight: '1.375rem' }], // 15
        title: ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '600' }], // 15
        h3: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }], // 16
        h2: ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em', fontWeight: '600' }], // 18
        h1: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.012em', fontWeight: '600' }], // 20
        kpi: ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.015em', fontWeight: '600' }], // 24
        display: ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.017em', fontWeight: '700' }], // 28
      },

      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--surface-3) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        'line-strong': 'rgb(var(--line-strong) / <alpha-value>)',
        divider: 'rgb(var(--divider) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        subtle: 'rgb(var(--ink-subtle) / <alpha-value>)',
        // Modal/drawer pardasi — `bg-scrim/55`.
        scrim: 'rgb(var(--scrim) / <alpha-value>)',

        // --- Interaktiv qatlam ---
        primary: {
          DEFAULT: '#0C7A4D', // oq matn 5.38:1
          hover: '#0A6741',
          pressed: '#084F32',
          'on-dark': '#0E8855',
          on: '#FFFFFF',
          text: 'rgb(var(--primary-text) / <alpha-value>)',
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

        // --- Aksent qatlam ---
        mint: {
          DEFAULT: '#1FCA8E',
          bright: '#27D89B',
          deep: '#10A064',
          soft: '#6FE4B8',
          on: '#06231A',
          tint: 'rgb(var(--mint-tint) / <alpha-value>)',
        },

        focus: 'rgb(var(--focus-ring) / <alpha-value>)',

        // Amber = faqat qo'lda aralashuv.
        override: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          dark: '#B45309',
          deep: '#B45309',
          tint: 'rgb(var(--warning-tint) / <alpha-value>)',
        },
        danger: {
          DEFAULT: '#E5484D',
          light: '#FF6369',
          dark: '#B91C1C',
          deep: '#B91C1C',
          tint: 'rgb(var(--danger-tint) / <alpha-value>)',
        },
        info: {
          DEFAULT: '#3B82F6',
          light: '#60A5FA',
          dark: '#1D4ED8',
          deep: '#1D4ED8',
          tint: 'rgb(var(--info-tint) / <alpha-value>)',
        },
        violet: {
          DEFAULT: '#8B5CF6',
          light: '#A78BFA',
          dark: '#6D28D9',
          deep: '#6D28D9',
          tint: 'rgb(var(--accent-tint) / <alpha-value>)',
        },
      },

      // Panel radius shkalasi: 6 / 8 / 10 / 12 / 14 (tokens.css).
      borderRadius: {
        'ds-xs': 'var(--radius-xs)',
        'ds-sm': 'var(--radius-sm)',
        'ds-md': 'var(--radius-md)',
        'ds-lg': 'var(--radius-lg)',
        'ds-xl': 'var(--radius-xl)',
      },

      boxShadow: {
        card: 'var(--shadow-card)',
        hairline: 'var(--shadow-hairline)',
        pop: 'var(--shadow-pop)',
        // Eski nomlar — kompilyatsiya buzilmasin; panelda glow YO'Q.
        cta: 'var(--shadow-cta)',
        'glow-mint': 'none',
        'glow-primary': 'none',
        'glow-mint-sm': 'none',
      },

      spacing: {
        sidebar: 'var(--sidebar-width)',
        rail: 'var(--sidebar-rail)',
        topbar: 'var(--topbar-height)',
      },

      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },

      backgroundImage: {
        'gradient-cta': 'linear-gradient(135deg, #0C7A4D 0%, #084F32 100%)',
        'gradient-mint': 'linear-gradient(225deg, #27D89B 0%, #10A064 100%)',
        'gradient-ink': 'linear-gradient(135deg, #0F1B22 0%, #1D3A2F 100%)',
      },

      transitionDuration: {
        fast: '150ms',
        base: '200ms',
        slow: '300ms',
        slower: '500ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
        emphasized: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },

      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(229,72,77,0.55)' },
          '70%': { boxShadow: '0 0 0 8px rgba(229,72,77,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(229,72,77,0)' },
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
        'scale-in': {
          from: { transform: 'scale(0.98)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 150ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slide-up 150ms cubic-bezier(0, 0, 0.2, 1)',
        'scale-in': 'scale-in 120ms cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [],
};
