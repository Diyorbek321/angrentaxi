import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/driver_legal.dart';

/// Huquqiy profil maydonlari tekshiruvi — server qoidalari bilan bir xil
/// (`backend/src/modules/drivers/dto/update-driver-legal.dto.ts`):
/// JShShIR — aynan 14 raqam, STIR — aynan 9 raqam, YaTT uchun STIR majburiy.
///
/// Mijoz tomonda tekshirish — haydovchi xatoni yozayotgan joyida ko'rsin,
/// serverning inglizcha/umumiy 400 javobini emas.
abstract final class LegalValidators {
  static final RegExp _pinfl = RegExp(r'^\d{14}$');
  static final RegExp _tin = RegExp(r'^\d{9}$');

  /// Bo'sh joy va chiziqchalarni olib tashlaydi (haydovchi raqamni
  /// "3 1234 ..." ko'rinishida yozishi mumkin).
  static String normalizeDigits(String? value) =>
      (value ?? '').replaceAll(RegExp(r'[\s-]'), '');

  static String? pinfl(String? value) {
    final digits = normalizeDigits(value);
    if (digits.isEmpty) return AppL10n.current.lglValPinflRequired;
    if (!_pinfl.hasMatch(digits)) return AppL10n.current.lglValPinflFormat;
    return null;
  }

  /// STIR: YaTT uchun majburiy, o'zini o'zi band qilgan uchun ixtiyoriy —
  /// lekin kiritilgan bo'lsa formati baribir to'g'ri bo'lishi kerak.
  static String? tin(String? value, {required DriverTaxStatus? taxStatus}) {
    final digits = normalizeDigits(value);
    if (digits.isEmpty) {
      return taxStatus == DriverTaxStatus.individualEntrepreneur
          ? AppL10n.current.lglValTinRequired
          : null;
    }
    if (!_tin.hasMatch(digits)) return AppL10n.current.lglValTinFormat;
    return null;
  }

  static String? taxStatus(DriverTaxStatus? value) =>
      value == null ? AppL10n.current.lglValTaxStatusRequired : null;
}
