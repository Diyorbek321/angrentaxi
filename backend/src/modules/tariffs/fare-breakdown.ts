/**
 * Safar narxining qatorlarga ajratilgan tarkibi.
 *
 * NEGA ALOHIDA TIP: chekni jonli tarifdan qayta hisoblab bo'lmaydi. Tarif bir
 * oydan keyin o'zgarsa, o'sha safar cheki boshqa raqam ko'rsatadi va hujjat
 * yolg'on gapiradi. Shuning uchun tarkib safar tugagan lahzada `orders`
 * jadvaliga muzlatib yoziladi (`fare_breakdown` jsonb).
 *
 * ⚠️ INVARIANT — buzilmasligi shart:
 *
 *   baseFare + distanceFare + timeFare
 *     + minPriceAdjustment + surgeFare + maxPriceCap
 *     + waitingFare === total
 *
 * Bu shunchaki did masalasi emas. Chek qatorlari jamiga qo'shilmasa, u
 * chekning umuman yo'qligidan ham yomon — foydalanuvchi hisob-kitobda xato
 * borligini ko'radi-yu, qayerdaligini tushunmaydi. Invariant
 * `tariffs.service.spec.ts` da qo'riqlanadi.
 */
export interface FareBreakdown {
  /** Tarifning boshlang'ich haqi (`tariff.basePrice`). */
  baseFare: number;

  distanceKm: number;
  pricePerKm: number;
  /** `distanceKm * pricePerKm`. */
  distanceFare: number;

  durationMin: number;
  pricePerMin: number;
  /** `durationMin * pricePerMin`. */
  timeFare: number;

  /**
   * "Eng kam haq" tuzatmasi — hisoblangan summa `tariff.minPrice` dan past
   * bo'lsa, farqi shu yerda ko'rinadi. Har doim >= 0.
   *
   * Alohida qator sifatida chiqariladi, chunki yo'lovchi "2 km yurdim, nega
   * 15 000 so'm?" deb so'raganda javob aynan shu qator bo'ladi.
   */
  minPriceAdjustment: number;

  /** Qo'llanilgan koeffitsient: `max(tarif surge, hudud surge)`. */
  surgeMultiplier: number;

  /**
   * Koeffitsient qo'shgan summa. Koeffitsient 1.0 bo'lsa — 0.
   * Chekda "Talab yuqori" qatori sifatida ko'rinadi.
   */
  surgeFare: number;

  /**
   * `tariff.maxPrice` kesib tashlagan summa. Har doim <= 0 (yoki cheklov
   * yo'q bo'lsa 0). Manfiy bo'lgani uchun jamiga to'g'ridan-to'g'ri qo'shiladi.
   */
  maxPriceCap: number;

  /**
   * HAQ OLINADIGAN kutish daqiqalari — BEPUL DAQIQALAR ALLAQACHON AYIRILGAN.
   *
   * Ya'ni bu "haydovchi qancha kutdi" emas, "necha daqiqa uchun pul olindi".
   * 7 daqiqa 10 soniya kutilgan va 3 daqiqa bepul bo'lsa — bu yerda 5
   * (`ceil(7.17) - 3`). Chek qatori aynan shu raqamni ko'rsatadi, shuning
   * uchun u to'lov bilan bevosita mos bo'lishi kerak: yo'lovchi "5 daqiqa —
   * 2500 so'm" ni bir qarashda tekshira olsin.
   *
   * Yaxlitlash qoidasi va uning sababi: `waiting-charge.ts`,
   * `computeWaitingMinutes`.
   */
  waitingMinutes: number;

  /**
   * `waitingMinutes * tariff.waitingPricePerMinute`.
   *
   * ⚠️ QAT'IY NARXLI SAFARDA HAM NOLDAN FARQLI BO'LISHI MUMKIN. Kutish haqi
   * qat'iy narx kafolatidan TASHQARIDA: kafolat marshrut noaniqligini yopadi,
   * kutish esa yo'lovchi boshqaradigan xarajat. Shuning uchun bu qator
   * `maxPriceCap` dan keyin, chegara va koeffitsientdan tashqarida qo'shiladi.
   *
   * ⚠️ ESKI SAFARLARDA maydon UMUMAN YO'Q: `fare_breakdown` jsonb qatorlari
   * migratsiyadan oldin yozilgan bo'lsa, o'qiyotgan tomon uni `0` deb
   * qabul qilishi kerak (`withWaitingFare` shunday qiladi).
   */
  waitingFare: number;

  /** Yakuniy summa. `calculatePrice()` natijasi bilan AYNAN teng. */
  total: number;
}
