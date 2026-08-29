import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

// ============================================================================
// HAPTIKA — teginishga jismoniy javob.
//
// Muammo: 114 Dart faylining birortasida ham `HapticFeedback` yo'q edi.
// Bu "shablon ilova" hissining eng sezilmas, lekin eng kuchli sababi:
// premium ilovalarda har bir muhim teginish barmoqda javob beradi,
// bu yerda esa ekran jim edi.
//
// Bu fayl XOM `HapticFeedback` chaqiruvlarini emas, MA'NOLI hodisalarni
// taqdim etadi. Ekran kodi "qanday tebranish" emas, "nima sodir bo'ldi"
// ni aytadi — shunda platformalar orasidagi farqni bitta joyda boshqaramiz.
//
// PLATFORMA FARQI (muhim):
//   iOS'da Taptic Engine bor — `selectionClick` aniq va nozik.
//   Android'da esa u ko'pincha umuman sezilmaydi, shuning uchun tanlov
//   uchun `lightImpact` ishlatiladi. Muvaffaqiyat/xato naqshlari iOS'da
//   tizim tomonidan berilmaganligi uchun ikkala platformada ham qo'lda
//   ketma-ketlik sifatida quriladi.
// ============================================================================

/// Ma'noli haptik hodisalar.
///
/// Barcha metodlar `Future` qaytaradi, lekin ularni `await` qilish
/// SHART EMAS — haptika hech qachon UI'ni kutib turmasligi kerak.
abstract final class AppHaptics {
  /// Butun ilova bo'ylab haptikani o'chirish (foydalanuvchi sozlamasi).
  static bool enabled = true;

  static bool get _iOS => defaultTargetPlatform == TargetPlatform.iOS;

  static bool get _supported =>
      enabled &&
      (defaultTargetPlatform == TargetPlatform.iOS ||
          defaultTargetPlatform == TargetPlatform.android);

  /// Oddiy teginish — har qanday tugma, ro'yxat elementi, ikona tugmasi.
  /// Eng ko'p ishlatiladigan; shuning uchun eng yengili.
  static Future<void> tap() async {
    if (!_supported) return;
    await HapticFeedback.lightImpact();
  }

  /// Tanlov o'zgardi — tarif almashtirildi, toggle, segmented control,
  /// picker aylantirildi.
  static Future<void> select() async {
    if (!_supported) return;
    // Android'da `selectionClick` ko'pincha sezilmaydi.
    await (_iOS
        ? HapticFeedback.selectionClick()
        : HapticFeedback.lightImpact());
  }

  /// Sezilarli harakat — sheet ochildi, ekran o'zgardi, element o'chirildi.
  static Future<void> impact() async {
    if (!_supported) return;
    await HapticFeedback.mediumImpact();
  }

  /// Katta lahza — haydovchi topildi, safar boshlandi.
  static Future<void> heavy() async {
    if (!_supported) return;
    await HapticFeedback.heavyImpact();
  }

  /// Muvaffaqiyat — buyurtma yaratildi, to'lov o'tdi, safar tugadi.
  ///
  /// Ikki zarbali ko'tariluvchi naqsh: yengil → o'rta. Foydalanuvchi buni
  /// "hal bo'ldi" deb o'qiydi.
  static Future<void> success() async {
    if (!_supported) return;
    await HapticFeedback.lightImpact();
    await Future<void>.delayed(const Duration(milliseconds: 90));
    await HapticFeedback.mediumImpact();
  }

  /// Ogohlantirish — tasdiq talab qilinadi, chegaraga yetildi.
  /// Bitta o'rta zarba + qisqa takror.
  static Future<void> warning() async {
    if (!_supported) return;
    await HapticFeedback.mediumImpact();
    await Future<void>.delayed(const Duration(milliseconds: 120));
    await HapticFeedback.lightImpact();
  }

  /// Xato — so'rov muvaffaqiyatsiz, noto'g'ri kod, to'lov rad etildi.
  ///
  /// Uch zarbali "silkinish" naqshi — ijobiy naqshlardan aniq farq qiladi.
  static Future<void> error() async {
    if (!_supported) return;
    await HapticFeedback.heavyImpact();
    await Future<void>.delayed(const Duration(milliseconds: 80));
    await HapticFeedback.heavyImpact();
    await Future<void>.delayed(const Duration(milliseconds: 80));
    await HapticFeedback.mediumImpact();
  }

  /// Uzun bosish (long-press) — kontekst menyu, sudrab ko'chirish boshlandi.
  static Future<void> longPress() async {
    if (!_supported) return;
    await HapticFeedback.mediumImpact();
  }
}
