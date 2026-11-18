import 'dart:math' as math;

import 'package:flutter/foundation.dart' show immutable;

// ============================================================================
// KUTISH HAQI — MOBIL TOMONDAGI YAGONA HISOB.
//
// ⚠️ NEGA ALOHIDA FAYL. Bu raqamni IKKI ilova ko'rsatadi: haydovchi
// (`arrived_screen.dart`) va yo'lovchi (`active_order_view.dart`). Ular
// bir xil sonni ko'rsatishi SHART — bu toifadagi eng nizoli raqam, va
// "haydovchida 2 500, menda 2 000 turibdi" degan da'vo hisoblagichni
// umuman ishonchsiz qilib qo'yadi. Ikki ekranda ikki nusxa formula bo'lsa
// ular ertami-kechmi ajralib ketadi, shuning uchun formula BITTA joyda.
//
// ⚠️ SERVER BILAN BIR XIL. Backend'dagi qoida —
// `backend/src/modules/tariffs/waiting-charge.ts` — pul undiradigan yagona
// hisob. Bu yerdagi kod uning AYNAN nusxasi: bir xil oyna, bir xil
// yaxlitlash, bir xil xavfsiz holatlar. Ekranda 3 so'm, chekda 4 so'm
// chiqmasligi uchun ular birga o'zgarishi kerak.
//
// ⚠️ BIZNES QOIDASI: kutish haqi HAR DOIM undiriladi — qat'iy narx
// kafolatidan TASHQARI. Qat'iy narx MARSHRUT noaniqligini yopadi
// (tirbandlik, uzunroq yo'l — haydovchi buni boshqarmaydi), kutish esa
// YO'LOVCHI boshqaradigan narsa. Shuning uchun yo'lovchiga ko'rsatiladigan
// summa "quote + kutish" bo'lishi mumkin.
// ============================================================================

/// Bepul kutish oynasi, daqiqa.
///
/// ⚠️ FAQAT ZAXIRA. Haqiqiy qiymat har bir buyurtma javobida
/// `order.freeWaitMinutes` bo'lib keladi (backend uni `attachDisplayFields`
/// da tarifdan tekislab qo'yadi). Bu doimiy faqat maydon UMUMAN kelmaganda
/// ishlatiladi: eski APK yangi serverga ulanmagan holat va migratsiyadan
/// oldin yaratilgan tariflar. Backend'dagi `DEFAULT_FREE_WAIT_MINUTES`
/// bilan bir xil bo'lishi shart.
const int kDefaultFreeWaitMinutes = 3;

/// Bepul oynadan keyingi har bir BOSHLANGAN daqiqa narxi, so'm.
///
/// Zaxira qiymat — [kDefaultFreeWaitMinutes] dagi izohga qarang.
const int kDefaultWaitingPricePerMinute = 500;

const int _microsPerMinute = Duration.microsecondsPerMinute;

/// Bir lahzadagi kutish holati: qancha vaqt o'tdi, qancha pul yig'ildi.
@immutable
class WaitingCharge {
  const WaitingCharge({
    required this.elapsed,
    required this.freeRemaining,
    required this.billableMinutes,
    required this.fare,
  });

  /// Hisoblagich umuman ishlamaydigan holat: haydovchi hali "keldim"
  /// bosmagan yoki buyurtma migratsiyadan oldin yaratilgan.
  static const WaitingCharge none = WaitingCharge(
    elapsed: Duration.zero,
    freeRemaining: Duration.zero,
    billableMinutes: 0,
    fare: 0,
  );

  /// `arrivedAt` dan hozirgacha o'tgan vaqt. Hech qachon manfiy emas.
  final Duration elapsed;

  /// Bepul oynadan qancha qolgani. Oyna tugagach [Duration.zero].
  final Duration freeRemaining;

  /// HAQ OLINADIGAN daqiqalar — bepul daqiqalar ALLAQACHON ayirilgan.
  /// Ya'ni "qancha kutildi" emas, "necha daqiqa uchun pul olinadi".
  final int billableMinutes;

  /// Shu lahzada yig'ilgan summa, so'm. Har doim BUTUN son.
  final int fare;

  /// Bepul oyna hali ketayotgan bo'lsa `true`.
  ///
  /// Chegara [billableMinutes] orqali aniqlanadi, `freeRemaining` orqali
  /// EMAS: 3:00.000 lahzasida qolgan vaqt nol, lekin haq hali yo'q va
  /// ekranda "hisoblanmoqda" deb turishi yolg'on bo'lardi.
  bool get isFree => billableMinutes == 0;

  /// Haq yig'ila boshlagan bo'lsa `true`.
  bool get isBilling => billableMinutes > 0;
}

/// Kutish holatini hisoblaydi.
///
/// ⚠️ YAXLITLASH — BOSHLANGAN DAQIQA TO'LIQ HISOBLANADI:
///
///     haqli = max(0, ceil(o'tgan_vaqt_daqiqada) - bepul_daqiqa)
///
/// Ya'ni 3:00.000 — HALI BEPUL; 3:00.001 dan boshlab to'rtinchi daqiqa
/// BOSHLANGAN deb qaraladi va to'liq undiriladi (500 so'm). 7:10 kutish →
/// ceil(7.17) = 8, 8 - 3 = 5 daqiqa = 2500 so'm.
///
/// NEGA yuqoriga: taksi hisoblagichlarining odatiy qoidasi, va bu server
/// bilan bir xil (`waiting-charge.ts`). Ikki xil yaxlitlash bo'lsa
/// ekrandagi raqam bilan chekdagi raqam farq qilardi — aynan shu farq
/// hisoblagichga bo'lgan ishonchni yo'q qiladi.
///
/// ⚠️ YAXLITLASH BUTUN SONDA. Daqiqa `ceil` mikrosekund arifmetikasi bilan
/// olinadi, `double` bo'linma orqali emas: `elapsed / 60000` ko'rinishidagi
/// suzuvchi nuqta 180000 ms uchun 3.0000000000000004 berib, chegarada
/// bepul daqiqani "tugagan" deb ko'rsatib yuborishi mumkin edi. Narx ham
/// butun × butun, ya'ni so'm har doim aniq butun son.
///
/// XAVFSIZ HOLATLAR — hammasi 0 beradi, hech qachon ortiqcha undirilmaydi:
///   · `arrivedAt == null` (eski buyurtma / "keldim" bosilmagan)
///   · teskari tartibdagi vaqtlar (qurilma soati orqada) → chegirmaga
///     AYLANMAYDI, shunchaki nol
///   · manfiy yoki yaroqsiz tarif qiymatlari
WaitingCharge computeWaitingCharge({
  required DateTime? arrivedAt,
  required DateTime now,
  int freeWaitMinutes = kDefaultFreeWaitMinutes,
  int waitingPricePerMinute = kDefaultWaitingPricePerMinute,
}) {
  if (arrivedAt == null) return WaitingCharge.none;

  // Buzuq tarif (manfiy qiymat) narxni manfiyga aylantirmasin.
  final freeMinutes = math.max(0, freeWaitMinutes);
  final pricePerMinute = math.max(0, waitingPricePerMinute);

  // ⚠️ Qurilma soati serverdan orqada bo'lsa `difference` manfiy chiqadi.
  // Nolga qisamiz: manfiy daqiqa yo'lovchiga chegirma bo'lib qolardi.
  final rawMicros = now.difference(arrivedAt).inMicroseconds;
  final elapsedMicros = rawMicros > 0 ? rawMicros : 0;

  // Butun sonli yuqoriga yaxlitlash: ceil(a / b) == (a + b - 1) ~/ b.
  final minutesStarted =
      (elapsedMicros + _microsPerMinute - 1) ~/ _microsPerMinute;
  final billableMinutes = math.max(0, minutesStarted - freeMinutes);

  final freeWindowMicros = freeMinutes * _microsPerMinute;
  final freeRemainingMicros = math.max(0, freeWindowMicros - elapsedMicros);

  return WaitingCharge(
    elapsed: Duration(microseconds: elapsedMicros),
    freeRemaining: Duration(microseconds: freeRemainingMicros),
    billableMinutes: billableMinutes,
    fare: billableMinutes * pricePerMinute,
  );
}

/// Kutish soatini `M:SS` (bir soatdan oshsa `H:MM:SS`) ko'rinishida beradi.
///
/// ⚠️ SONIYALAR YUQORIGA YAXLITLANADI. Bu asosan SANOQ ORQAGA uchun
/// kerak: 0.4 soniya qolganda pastga yaxlitlash "0:00" chiqarardi, holbuki
/// oyna hali tugamagan va haq boshlanmagan. Yuqoriga yaxlitlanganda "0:00"
/// AYNAN oyna tugagan lahzada paydo bo'ladi — ya'ni ekrandagi nol bilan
/// pulning boshlanishi bir vaqtga tushadi.
/// O'TGAN vaqtni `m:ss` ko'rinishida beradi — sekundomer semantikasi.
///
/// ⚠️ NEGA [formatWaitClock] DAN ALOHIDA. U QOLGAN vaqtni ko'rsatadi va
/// soniyani YUQORIGA yaxlitlaydi: 1:29.4 qolgan bo'lsa "1:30" chiqadi va
/// hisoblagich nolga aynan vaqtida yetadi. O'tgan vaqt uchun bu xato
/// bo'lardi — 7:10.0001 o'tganda "7:11" ko'rsatilardi, ya'ni ekran
/// haydovchiga hali o'tmagan soniyani ko'rsatadi va "yo'lovchi kelmadi"
/// qarori bir soniya erta olinishi mumkin edi.
///
/// Shuning uchun bu yerda PASTGA yaxlitlanadi: faqat TO'LIQ o'tgan soniya
/// ko'rsatiladi.
///
/// Bu narxga TA'SIR QILMAYDI — haq [computeWaitingCharge] da daqiqa
/// bo'yicha alohida hisoblanadi.
String formatWaitElapsed(Duration duration) {
  final totalSeconds = duration.isNegative ? 0 : duration.inSeconds;

  final hours = totalSeconds ~/ 3600;
  final minutes = (totalSeconds % 3600) ~/ 60;
  final seconds = totalSeconds % 60;
  final ss = seconds.toString().padLeft(2, '0');

  if (hours > 0) {
    return '$hours:${minutes.toString().padLeft(2, '0')}:$ss';
  }
  return '$minutes:$ss';
}

String formatWaitClock(Duration duration) {
  final micros = duration.inMicroseconds;
  final totalSeconds = micros <= 0
      ? 0
      : (micros + Duration.microsecondsPerSecond - 1) ~/
          Duration.microsecondsPerSecond;

  final hours = totalSeconds ~/ 3600;
  final minutes = (totalSeconds % 3600) ~/ 60;
  final seconds = totalSeconds % 60;
  final ss = seconds.toString().padLeft(2, '0');

  if (hours > 0) {
    return '$hours:${minutes.toString().padLeft(2, '0')}:$ss';
  }
  return '$minutes:$ss';
}
