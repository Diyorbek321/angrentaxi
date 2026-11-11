// @ts-check
import tseslint from 'typescript-eslint';

/**
 * Backend lint konfiguratsiyasi.
 *
 * NEGA umuman kerak: shu paytgacha backend'da hech qanday ESLint sozlamasi
 * yo'q edi, ya'ni CI lint bosqichini BUTUNLAY o'tkazib yuborardi
 * (`.github/workflows/ci.yml`). `tsc` faqat turlarni tekshiradi — kutilmagan
 * `await`siz promise yoki jimgina yutilgan xato uning uchun mutlaqo to'g'ri
 * kod.
 *
 * ⚠️ Qoidalar TANLAB olingan, "hammasini yoq" emas. Mavjud 40 000+ qatorli
 * kodga to'liq qat'iy to'plamni qo'llash yuzlab ogohlantirish berardi va
 * ular birinchi kundan e'tibordan chiqib ketardi — lint faqat YASHIL
 * bo'lganda foydali. Shuning uchun asos sifatida tur-xabardor tavsiya
 * to'plami olinadi va real nuqsonni ko'rsatmaydigan bir nechta qoida
 * ataylab o'chiriladi.
 */
export default tseslint.config(
  {
    // Build artefaktlari va konfiguratsiyaning o'zi lint qilinmaydi.
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', 'eslint.config.mjs'],
  },

  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },

    rules: {
      /**
       * ENG QIMMAT QOIDA. `await`siz qolgan promise — bu kodda real xato
       * sinfi: buyurtma taqsimlash, to'lov va bildirishnoma yo'llarining
       * hammasi async. Kutilmagan promise'ning xatosi hech qayerda
       * ushlanmaydi va jarayonni jimgina yiqitishi mumkin.
       *
       * ATAYLAB qoldirilgan "ishga tushirib unut" chaqiruvlar
       * (`matching.startSearch(...)`) allaqachon `.catch()` bilan
       * yozilgan — qoida ularni to'g'ri deb qabul qiladi.
       */
      '@typescript-eslint/no-floating-promises': 'error',

      /**
       * `any` — xato emas, ogohlantirish.
       *
       * Kod bazasida u asosan tashqi JSON bilan ishlaydigan chegaralarda
       * uchraydi (to'lov callback'lari, PostGIS raw so'rovlari). Ularni
       * bir zumda tuzatib bo'lmaydi, lekin yangi `any` ko'rinib turishi
       * kerak — shuning uchun `warn`, `off` emas.
       */
      '@typescript-eslint/no-explicit-any': 'warn',

      /**
       * Ishlatilmagan o'zgaruvchilar. Ostki chiziq bilan boshlanadiganlari
       * chetlab o'tiladi: destrukturizatsiyada maydonni ATAYLAB tashlab
       * yuborish shu bilan ifodalanadi (`const { pass: _pass, ...rest }`).
       */
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      /**
       * ⚠️ O'CHIRILGAN: `no-unsafe-*` oilasi.
       *
       * Ular `any` dan kelib chiqadigan har bir amalni belgilaydi, ya'ni
       * bitta `query()` natijasi o'nlab ogohlantirish beradi. Nuqson
       * MANBASI bitta — turlanmagan raw so'rov — va uni
       * `no-explicit-any` allaqachon ko'rsatadi. Ikkinchi marta, o'n
       * baravar shovqin bilan takrorlash lintni o'qilmas qilardi.
       */
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',

      /**
       * ⚠️ O'CHIRILGAN: shablon satrida raqam/bool ishlatishni taqiqlash.
       * Jurnal xabarlarida `${count}` mutlaqo normal va uni har safar
       * `String(count)` ga o'rash matnni faqat shovqinli qiladi.
       */
      '@typescript-eslint/restrict-template-expressions': 'off',

      /**
       * ⚠️ O'CHIRILGAN: `no-unnecessary-type-assertion`.
       *
       * Bu kod bazasida qoida MUNTAZAM yolg'on ijobiy beradi. Sabab —
       * xom SQL: `repository.query(...)` `Promise<any>` qaytaradi, va
       * undagi `as Promise<Array<{...}>>` kasti qoida uchun "ortiqcha"
       * ko'rinadi (chunki `any` ni istalgan turga berish mumkin), aslida
       * esa AYNAN o'sha kast natijaga tur beradi.
       *
       * Qoidaning `--fix` rejimi shu kastlarni olib tashlab, 21 ta test
       * to'plamini kompilyatsiyadan chiqarib yubordi. Xato ko'rsatadigan
       * va tuzatganda kodni buzadigan qoida yo'qligidan yomonroq.
       */
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',

      /**
       * ⚠️ O'CHIRILGAN: `require-await`.
       *
       * Belgilagan holatlarning hammasi INTERFEYS SHARTNOMASI:
       * `IPaymentProvider.initiate/verify`, `IPayoutProvider.send`,
       * Nest'ning `OnGatewayDisconnect.handleDisconnect`. Ular `async`
       * bo'lishi shart, chunki shartnoma shunday — hozirgi amalga
       * oshirishda kutadigan narsa yo'qligi vaqtinchalik holat
       * (`ManualPayoutProvider` tarmoqqa chiqmaydi, ertaga chiqadigani
       * chiqadi).
       *
       * `async` ni olib tashlash imzoni buzardi va qoidani qondirish
       * uchun kodni yomonlashtirardi. Asinxron xatolarni ushlaydigan
       * haqiqiy qoida — `no-floating-promises` — yoqiq turibdi.
       */
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    // Testlar. Mock'lar tabiatan turlanmagan bo'ladi va `as never` /
    // qisman obyektlar bu yerda ATAYLAB ishlatiladi — ularni ishlab
    // chiqarish kodi bilan bir xil o'lchov bilan tekshirish testlarni
    // o'qilmas qilardi.
    files: ['**/*.spec.ts', '**/*.testing.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
);
