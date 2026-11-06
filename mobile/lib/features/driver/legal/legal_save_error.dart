import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/l10n/l10n.dart';

// ============================================================================
// HUQUQIY PROFILNI SAQLASH XATOLARI — `PATCH /drivers/me/legal`
// (docs/LEGAL-COMPLIANCE.md §21, §25 #4).
// ============================================================================

/// Saqlash nega rad etildi.
enum LegalSaveErrorKind {
  /// 403 `LEGAL_PROFILE_LOCKED` — hujjat tasdiqlangan; PINFL/STIR/soliq
  /// maqomi/tug'ilgan sana faqat operator orqali.
  locked,

  /// 409 `LEGAL_PROFILE_DUPLICATE`, `field: 'pinfl'`.
  duplicatePinfl,

  /// 409 `LEGAL_PROFILE_DUPLICATE`, `field: 'tin'`.
  duplicateTin,
}

/// Kod bo'yicha turkum; tanilmasa `null` (server matni ko'rsatiladi).
LegalSaveErrorKind? legalSaveErrorKind(ApiError? error) {
  switch (error?.code) {
    case ApiErrorCode.legalProfileLocked:
      return LegalSaveErrorKind.locked;
    case ApiErrorCode.legalProfileDuplicate:
      return error!.detailText('field') == 'tin'
          ? LegalSaveErrorKind.duplicateTin
          : LegalSaveErrorKind.duplicatePinfl;
  }
  return null;
}

/// Ilova tilidagi matn.
String legalSaveErrorMessage(LegalSaveErrorKind kind) {
  final l10n = AppL10n.current;
  return switch (kind) {
    LegalSaveErrorKind.locked => l10n.lglLockedNote,
    LegalSaveErrorKind.duplicatePinfl => l10n.lglDuplicatePinfl,
    LegalSaveErrorKind.duplicateTin => l10n.lglDuplicateTin,
  };
}
