import 'package:equatable/equatable.dart';

// ============================================================================
// HAYDOVCHINING HUQUQIY PROFILI — `GET/PATCH /drivers/me/legal`
// (docs/LEGAL-COMPLIANCE.md §1, §5).
//
// Sabab matnlari (`reasons[].message`) SERVERDAN `Accept-Language` tilida
// (uz/ru, §21) keladi va ekranda o'zgarishsiz ko'rsatiladi — mobil tomonda
// sabab kodlari bo'yicha tarjima jadvali yo'q.
// ============================================================================

/// Soliq maqomi. `null` — hali tanlanmagan.
enum DriverTaxStatus { selfEmployed, individualEntrepreneur }

extension DriverTaxStatusWire on DriverTaxStatus {
  String get wireValue => switch (this) {
        DriverTaxStatus.selfEmployed => 'self_employed',
        DriverTaxStatus.individualEntrepreneur => 'individual_entrepreneur',
      };

  static DriverTaxStatus? fromWire(String? value) => switch (value) {
        'self_employed' => DriverTaxStatus.selfEmployed,
        'individual_entrepreneur' => DriverTaxStatus.individualEntrepreneur,
        _ => null,
      };
}

String? _trimmedOrNull(dynamic value) {
  if (value is! String) return null;
  final text = value.trim();
  return text.isEmpty ? null : text;
}

/// `YYYY-MM-DD` → sana (vaqt mintaqasisiz). Buzuq qiymat — `null`.
DateTime? parseLegalDate(dynamic value) {
  final text = _trimmedOrNull(value);
  if (text == null) return null;
  final parsed = DateTime.tryParse(text);
  if (parsed == null) return null;
  return DateTime(parsed.year, parsed.month, parsed.day);
}

/// Sana → serverning `YYYY-MM-DD` formati.
String formatLegalDate(DateTime date) {
  final y = date.year.toString().padLeft(4, '0');
  final m = date.month.toString().padLeft(2, '0');
  final d = date.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

class DriverLegalProfile extends Equatable {
  const DriverLegalProfile({
    this.taxStatus,
    this.pinfl,
    this.tin,
    this.birthDate,
    this.drivingLicenceIssuedAt,
    this.taxiLicenceNumber,
    this.taxiLicenceRegion,
    this.citizenship = 'UZ',
  });

  final DriverTaxStatus? taxStatus;
  final String? pinfl;
  final String? tin;
  final DateTime? birthDate;
  final DateTime? drivingLicenceIssuedAt;
  final String? taxiLicenceNumber;
  final String? taxiLicenceRegion;
  final String citizenship;

  static const empty = DriverLegalProfile();

  factory DriverLegalProfile.fromJson(Map<String, dynamic> json) {
    return DriverLegalProfile(
      taxStatus: DriverTaxStatusWire.fromWire(json['taxStatus'] as String?),
      pinfl: _trimmedOrNull(json['pinfl']),
      tin: _trimmedOrNull(json['tin']),
      birthDate: parseLegalDate(json['birthDate']),
      drivingLicenceIssuedAt: parseLegalDate(json['drivingLicenceIssuedAt']),
      taxiLicenceNumber: _trimmedOrNull(json['taxiLicenceNumber']),
      taxiLicenceRegion: _trimmedOrNull(json['taxiLicenceRegion']),
      citizenship: _trimmedOrNull(json['citizenship']) ?? 'UZ',
    );
  }

  /// PATCH tanasi — bo'sh qiymat `null` bo'lib ketadi (server maydonni
  /// tozalaydi). Fuqarolik yuborilmaydi: uni haydovchi o'zgartirmaydi.
  Map<String, dynamic> toPatchJson() => {
        'taxStatus': taxStatus?.wireValue,
        'pinfl': pinfl,
        'tin': tin,
        'birthDate': birthDate == null ? null : formatLegalDate(birthDate!),
        'drivingLicenceIssuedAt': drivingLicenceIssuedAt == null
            ? null
            : formatLegalDate(drivingLicenceIssuedAt!),
        'taxiLicenceNumber': taxiLicenceNumber,
        'taxiLicenceRegion': taxiLicenceRegion,
      };

  @override
  List<Object?> get props => [
        taxStatus,
        pinfl,
        tin,
        birthDate,
        drivingLicenceIssuedAt,
        taxiLicenceNumber,
        taxiLicenceRegion,
        citizenship,
      ];
}

/// Bitta talab bajarilmagani sababi.
class LegalReason extends Equatable {
  const LegalReason({required this.code, required this.message});

  final String code;

  /// Server bergan matn (ilova tilida).
  final String message;

  /// `document_<kod>` — sabab tekshiruv ro'yxatidagi hujjat (yuklash
  /// "Tekshiruv" ekranida qilinadi, bu formada emas).
  bool get isDocument => code.startsWith('document_');

  factory LegalReason.fromJson(Map<String, dynamic> json) {
    final code = _trimmedOrNull(json['code']) ?? '';
    return LegalReason(
      code: code,
      message: _trimmedOrNull(json['message']) ?? code,
    );
  }

  @override
  List<Object?> get props => [code, message];
}

class LegalEligibility extends Equatable {
  const LegalEligibility({
    this.eligible = true,
    this.enforced = false,
    this.enforcedFrom,
    this.appliesToTaxi = false,
    this.blocking = false,
    this.reasons = const [],
  });

  final bool eligible;

  /// Majburlash sanasi o'tganmi.
  final bool enforced;

  /// Majburlash sanasi (o'tgan yoki kelajakdagi); `null` — majburlanmaydi.
  final DateTime? enforcedFrom;
  final bool appliesToTaxi;

  /// Haydovchi hozir taksi uchun onlayn chiqa OLMAYDI.
  final bool blocking;
  final List<LegalReason> reasons;

  static const unknown = LegalEligibility();

  /// Muhlat davri: sana belgilangan, lekin hali kelmagan.
  bool get inGracePeriod => !enforced && enforcedFrom != null;

  bool get hasDocumentReasons => reasons.any((r) => r.isDocument);

  factory LegalEligibility.fromJson(Map<String, dynamic> json) {
    final rawReasons = json['reasons'];
    final rawFrom = json['enforcedFrom'];
    return LegalEligibility(
      eligible: (json['eligible'] as bool?) ?? true,
      enforced: (json['enforced'] as bool?) ?? false,
      enforcedFrom: rawFrom is String ? DateTime.tryParse(rawFrom) : null,
      appliesToTaxi: (json['appliesToTaxi'] as bool?) ?? false,
      blocking: (json['blocking'] as bool?) ?? false,
      reasons: rawReasons is List
          ? rawReasons
              .whereType<Map<String, dynamic>>()
              .map(LegalReason.fromJson)
              .toList(growable: false)
          : const [],
    );
  }

  @override
  List<Object?> get props =>
      [eligible, enforced, enforcedFrom, appliesToTaxi, blocking, reasons];
}

class DriverLegalSummary extends Equatable {
  const DriverLegalSummary({
    this.profile = DriverLegalProfile.empty,
    this.eligibility = LegalEligibility.unknown,
  });

  final DriverLegalProfile profile;
  final LegalEligibility eligibility;

  factory DriverLegalSummary.fromJson(Map<String, dynamic> json) {
    final profile = json['profile'];
    final eligibility = json['eligibility'];
    return DriverLegalSummary(
      profile: profile is Map<String, dynamic>
          ? DriverLegalProfile.fromJson(profile)
          : DriverLegalProfile.empty,
      eligibility: eligibility is Map<String, dynamic>
          ? LegalEligibility.fromJson(eligibility)
          : LegalEligibility.unknown,
    );
  }

  @override
  List<Object?> get props => [profile, eligibility];
}
