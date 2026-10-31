import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/driver_verification.dart';

// ============================================================================
// HUQUQIY HUJJATLAR NOMI — tekshiruv ro'yxatidagi 4 ta talab
// (docs/LEGAL-COMPLIANCE.md §1, migratsiya 025).
//
// Server (v4, §21) bu 4 ta hujjatning `label`/`hint` ini `Accept-Language`
// bo'yicha o'zi tarjima qiladi — shuning uchun SERVER MATNI USTUN. Mahalliy
// jadval faqat ZAXIRA: yorliq umuman kelmasa (model uni kodga tenglaydi)
// yoki izoh bo'sh bo'lsa.
// ============================================================================

const Set<String> kLegalVerificationCodes = {
  'taxi_licence',
  'medical_check',
  'carrier_insurance',
  'tech_inspection',
};

bool isLegalVerificationCode(String code) =>
    kLegalVerificationCodes.contains(code);

/// Ekrandagi nom: server yorlig'i; huquqiy hujjatda yorliq yo'q bo'lsa —
/// ilova tilidagi zaxira.
String verificationItemLabel(DriverVerificationItem item) {
  final label = item.label.trim();
  if (label.isNotEmpty && label != item.code) return label;
  final l10n = AppL10n.current;
  return switch (item.code) {
    'taxi_licence' => l10n.lglDocTaxiLicence,
    'medical_check' => l10n.lglDocMedicalCheck,
    'carrier_insurance' => l10n.lglDocCarrierInsurance,
    'tech_inspection' => l10n.lglDocTechInspection,
    _ => item.label,
  };
}

String? verificationItemHint(DriverVerificationItem item) {
  final hint = item.hint?.trim();
  if (hint != null && hint.isNotEmpty) return hint;
  final l10n = AppL10n.current;
  return switch (item.code) {
    'taxi_licence' => l10n.lglDocTaxiLicenceHint,
    'medical_check' => l10n.lglDocMedicalCheckHint,
    'carrier_insurance' => l10n.lglDocCarrierInsuranceHint,
    'tech_inspection' => l10n.lglDocTechInspectionHint,
    _ => null,
  };
}
