/**
 * Angren Mint Design System — web-market (bozor sotuvchisi paneli).
 * YAGONA MANBA: docs/DESIGN-TOKENS.md
 *
 * QANDAY ISHLATILADI
 * 1. Shu faylni panelning `tailwind.config.js` fayliga NUSXALANG.
 * 2. `content` massivini panelning papka tuzilishiga moslang (pastda TODO).
 * 3. `docs/design/globals-mint.css` ni `src/app/globals.css` ga nusxalang —
 *    bu konfiguratsiya undagi CSS o'zgaruvchilarsiz ISHLAMAYDI.
 * 4. Panelga xos rang/animatsiya kerak bo'lsa — faylning oxiridagi
 *    "panel-spetsifik" bo'limiga qo'shing, token bloklarini o'zgartirmang.
 *
 * ⚠️ ENG MUHIM QOIDA — IKKI QATLAMNI ADASHTIRMANG:
 *      `bg-primary`  + `text-white`     → tugma, faol toggle, interaktiv fon
 *      `bg-mint`     + `text-mint-on`   → chip, badge, dekorativ to'ldirish
 *      `bg-mint-deep`                   → yorug' fonda ko'rinishi shart bo'lgan
 *                                         mint indikator (status nuqtasi)
 *    `text-white` ni HECH QACHON `bg-mint` ustida ishlatmang (2.12:1).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  darkMode: 'class',
  // web-market: butun kod `src/` ichida (app router + components + hooks).
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/hooks/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-manrope)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'monospace'],
      },

      // Kanonik tipografika shkalasi (mobil app_theme.dart bilan bir xil px).
      fontSize: {
        micro: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.02em', fontWeight: '800' }], // 11
        caption: ['0.75rem', { lineHeight: '1.125rem' }], // 12
        label: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '700' }], // 13
        body: ['0.875rem', { lineHeight: '1.375rem' }], // 14
        'body-lg': ['1rem', { lineHeight: '1.5rem' }], // 16
        title: ['1rem', { lineHeight: '1.5rem', fontWeight: '600' }], // 16
        h3: ['1.0625rem', { lineHeight: '1.5rem', fontWeight: '800' }], // 17
        h2: ['1.1875rem', { lineHeight: '1.625rem', letterSpacing: '-0.01em', fontWeight: '800' }], // 19
        h1: ['1.4375rem', { lineHeight: '1.875rem', letterSpacing: '-0.013em', fontWeight: '700' }], // 23
        display: ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.017em', fontWeight: '800' }], // 30
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
        divider: 'rgb(var(--divider) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        muted: 'rgb(var(--ink-muted) / <alpha-value>)',
        subtle: 'rgb(var(--ink-subtle) / <alpha-value>)',

        // ===================================================================
        // BREND — IKKI QATLAM. ⚠️ ENG KO'P XATO QILINADIGAN JOY.
        //
        //  `primary`  = INTERAKTIV TO'LDIRISH (#0C7A4D, to'q yashil).
        //     Tugma foni, faol toggle, tanlangan chegara, progress, link.
        //     Ustidagi matn HAR DOIM `text-white` (5.38:1).
        //
        //  `mint`     = AKSENT / DEKORATIV (#1FCA8E).
        //     Chip/badge foni, tinted yuza, dekorativ ikonka, gradient boshi,
        //     diagramma rangi. Ustidagi matn HAR DOIM `text-mint-on`
        //     (#06231A, 7.84:1) — HECH QACHON `text-white` (2.12:1).
        //
        //  QOIDA: mint yorug' yuzada MA'NO tashiy olmaydi (oq ustida 2.12:1).
        //  Yorug' fonda ko'rinishi shart bo'lgan mint element (status nuqtasi,
        //  indikator, diagramma) uchun `mint-deep` (#10A064, 3.37:1).
        // ===================================================================

        // --- Interaktiv qatlam ---
        primary: {
          DEFAULT: '#0C7A4D', // oq matn bilan 5.38:1 — AA
          hover: '#0A6741', // 6.93:1
          pressed: '#084F32', // 9.66:1
          'on-dark': '#0E8855', // qorong'i tema fill: oq 4.50:1, chegara 3.56:1
          on: '#FFFFFF', // primary to'ldirish ustidagi matn
          // Temaga mos yashil MATN (light #0C7A4D / dark #6FE4B8).
          text: 'rgb(var(--primary-text) / <alpha-value>)',
          // Eski `primary-NNN` shkalasi — chip/tint uchun saqlanadi.
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
          deep: '#10A064', // yorug' fonda ko'rinadigan mint (3.37:1)
          soft: '#6FE4B8', // qorong'i fonda matn (11.37:1)
          on: '#06231A', // mint to'ldirish ustidagi matn (7.84:1)
          tint: 'rgb(var(--mint-tint) / <alpha-value>)',
        },

        // Klaviatura fokus halqasi (light #0C7A4D / dark #6FE4B8).
        focus: 'rgb(var(--focus-ring) / <alpha-value>)',

        // Deliberate human intervention only. Mint/yashil = tizim o'zi
        // haydayapti, amber = odam aralashdi. Ular uzoq turishi shart.
        override: {
          DEFAULT: '#F59E0B', // kWarning
          light: '#FBBF24', // qorong'i temada matn (10.63:1)
          dark: '#B45309', // yorug' fonda MATN (5.02:1)
          deep: '#B45309',
          tint: 'rgb(var(--warning-tint) / <alpha-value>)',
        },
        danger: {
          DEFAULT: '#E5484D', // kError
          light: '#FF6369', // qorong'i temada matn (6.12:1)
          dark: '#B91C1C', // yorug' fonda MATN (6.47:1)
          deep: '#B91C1C',
          tint: 'rgb(var(--danger-tint) / <alpha-value>)',
        },
        info: {
          DEFAULT: '#3B82F6', // kInfo
          light: '#60A5FA', // qorong'i temada matn (6.98:1)
          dark: '#1D4ED8', // yorug' fonda MATN (6.70:1)
          deep: '#1D4ED8',
          tint: 'rgb(var(--info-tint) / <alpha-value>)',
        },
        violet: {
          DEFAULT: '#8B5CF6', // kAccentViolet
          light: '#A78BFA', // qorong'i temada matn (6.52:1)
          dark: '#6D28D9', // yorug' fonda MATN (7.10:1)
          deep: '#6D28D9',
          tint: 'rgb(var(--accent-tint) / <alpha-value>)',
        },
      },

      // Kanonik radius shkalasi (mobil kRadius* bilan bir xil px).
      // ⚠️ Tailwind'ning standart `rounded-lg/xl/md` nomlari ATAYLAB
      // qayta belgilanmagan — mavjud panellarda yuzlab joyda ishlatilgan.
      // Yangi kod `rounded-ds-*` ishlatsin.
      // (`ds` = design system; `mint` endi rang qatlamining nomi.)
      borderRadius: {
        'ds-xs': 'var(--radius-xs)', // 8px  — badge, kichik teg
        'ds-sm': 'var(--radius-sm)', // 12px — chip, ikona konteyneri
        'ds-md': 'var(--radius-md)', // 16px — tugma, input, karta
        'ds-lg': 'var(--radius-lg)', // 22px — katta karta, panel
        'ds-xl': 'var(--radius-xl)', // 28px — modal, drawer
      },

      boxShadow: {
        card: 'var(--shadow-card)', // elev-1
        pop: 'var(--shadow-pop)', // elev-2
        cta: 'var(--shadow-cta)', // elev-cta (primary glow)
        'glow-mint': '0 0 0 1px rgba(31,202,142,0.25), 0 6px 20px -6px rgba(31,202,142,0.45)',
        'glow-primary': '0 0 0 1px rgba(12,122,77,0.25), 0 6px 20px -6px rgba(12,122,77,0.45)',
        'glow-mint-sm': '0 0 12px -2px rgba(31,202,142,0.35)',
      },

      backgroundImage: {
        // Interaktiv CTA — OQ matn bilan. Eng och nuqta 5.38:1.
        'gradient-cta': 'linear-gradient(135deg, #0C7A4D 0%, #084F32 100%)',
        // Dekorativ mint gradient — CTA EMAS, ustiga faqat `text-ink`
        // (eng och nuqtada 9.48:1, eng to'qda 5.19:1). Oq matn 1.85:1 — TAQIQ.
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
      },
      animation: {
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fade-in 150ms cubic-bezier(0, 0, 0.2, 1)',
        'slide-in-right': 'slide-in-right 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        'slide-up': 'slide-up 150ms cubic-bezier(0, 0, 0.2, 1)',
      },

      // === PANEL-SPETSIFIK QO'SHIMCHALAR SHU YERGA ===
      // Masalan: web-market uchun "stok tugadi" rangi, web-restaurant uchun
      // "tayyorlanmoqda" holati. Yuqoridagi tokenlarni O'ZGARTIRMANG.
    },
  },
  plugins: [],
};
