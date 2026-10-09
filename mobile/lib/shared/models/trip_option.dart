import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';

// ============================================================================
// SAFAR OPSIYALARI — bola o'rindig'i, hayvon, konditsioner, katta bagaj.
//
// Server bilan kelishilgan xom qiymatlar (backend: trip-options.ts). Bu
// shunchaki izoh emas, MATCHING FILTRI: bola o'rindig'i so'ralgan safar
// faqat o'rindig'i bor haydovchiga taklif qilinadi.
//
// Noma'lum qiymat kelsa (server kelajakda yangi opsiya qo'shsa) u
// o'tkazib yuboriladi — eski APK yiqilmasligi kerak.
// ============================================================================

enum TripOption {
  childSeat('child_seat', Icons.child_friendly_rounded),
  pet('pet', Icons.pets_rounded),
  airConditioner('air_conditioner', Icons.ac_unit_rounded),
  bigLuggage('big_luggage', Icons.luggage_rounded);

  const TripOption(this.apiValue, this.icon);

  final String apiValue;
  String get label => switch (this) {
        TripOption.childSeat => AppL10n.current.shTripOptionChildSeat,
        TripOption.pet => AppL10n.current.shTripOptionPet,
        TripOption.airConditioner => AppL10n.current.shTripOptionAirConditioner,
        TripOption.bigLuggage => AppL10n.current.shTripOptionBigLuggage,
      };
  final IconData icon;

  static TripOption? fromApi(Object? value) {
    for (final option in TripOption.values) {
      if (option.apiValue == value) return option;
    }
    return null;
  }

  /// Server haqlari (`GET /settings/trip-option-fees`): `{"child_seat": 5000}`.
  /// Noma'lum opsiya va musbat bo'lmagan qiymat tashlanadi — haqsiz degani.
  static Map<TripOption, int> feesFromApi(Object? value) {
    if (value is! Map) return const {};
    final fees = <TripOption, int>{};
    for (final option in TripOption.values) {
      final fee = value[option.apiValue];
      if (fee is num && fee > 0) fees[option] = fee.round();
    }
    return fees;
  }

  /// Tanlangan opsiyalar uchun qo'shimcha haq yig'indisi, so'm.
  static int totalFee(Iterable<TripOption> options, Map<TripOption, int> fees) =>
      options.fold(0, (sum, option) => sum + (fees[option] ?? 0));

  /// JSON ro'yxatini o'qiydi; noma'lum va takroriy qiymatlar tashlanadi.
  static List<TripOption> listFromApi(Object? value) {
    if (value is! List) return const [];
    final result = <TripOption>[];
    for (final raw in value) {
      final option = fromApi(raw);
      if (option != null && !result.contains(option)) result.add(option);
    }
    return result;
  }
}
