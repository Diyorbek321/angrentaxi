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
