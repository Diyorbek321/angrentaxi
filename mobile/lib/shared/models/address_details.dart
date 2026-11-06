import 'package:equatable/equatable.dart';

/// Yetkazish manzilining qo'shimcha tafsilotlari — podyezd, qavat, xonadon,
/// domofon, mo'ljal va kuryerga izoh (docs/specs/food-market-ux-v5.md §3).
///
/// Hamma maydon ixtiyoriy. Bo'sh satrlar serverga YUBORILMAYDI: eski server
/// `addressDetails` ni bilmaydi (`forbidNonWhitelisted`), shuning uchun
/// tafsilot kiritilmagan bo'lsa butun obyekt tushirib qoldiriladi.
class AddressDetails extends Equatable {
  const AddressDetails({
    this.entrance,
    this.floor,
    this.apartment,
    this.intercom,
    this.landmark,
    this.courierNote,
  });

  // Server cheklovlari (spec §3) — forma ham shularni qo'llaydi.
  static const int entranceMax = 10;
  static const int floorMax = 10;
  static const int apartmentMax = 10;
  static const int intercomMax = 20;
  static const int landmarkMax = 120;
  static const int courierNoteMax = 200;

  final String? entrance;
  final String? floor;
  final String? apartment;
  final String? intercom;
  final String? landmark;
  final String? courierNote;

  static String? _clean(Object? value, int max) {
    if (value == null) return null;
    final text = value.toString().trim();
    if (text.isEmpty) return null;
    return text.length > max ? text.substring(0, max) : text;
  }

  /// Bo'sh qiymatlar `null` ga, uzunlar server chegarasiga qisqartiriladi.
  factory AddressDetails.normalized({
    String? entrance,
    String? floor,
    String? apartment,
    String? intercom,
    String? landmark,
    String? courierNote,
  }) {
    return AddressDetails(
      entrance: _clean(entrance, entranceMax),
      floor: _clean(floor, floorMax),
      apartment: _clean(apartment, apartmentMax),
      intercom: _clean(intercom, intercomMax),
      landmark: _clean(landmark, landmarkMax),
      courierNote: _clean(courierNote, courierNoteMax),
    );
  }

  /// `null` yoki noto'g'ri shakl — `null` (eski server maydonni bermaydi).
  static AddressDetails? tryParse(Object? json) {
    if (json is! Map) return null;
    final details = AddressDetails.normalized(
      entrance: json['entrance']?.toString(),
      floor: json['floor']?.toString(),
      apartment: json['apartment']?.toString(),
      intercom: json['intercom']?.toString(),
      landmark: json['landmark']?.toString(),
      courierNote: json['courierNote']?.toString(),
    );
    return details.isEmpty ? null : details;
  }

  bool get isEmpty =>
      entrance == null &&
      floor == null &&
      apartment == null &&
      intercom == null &&
      landmark == null &&
      courierNote == null;

  /// Faqat to'ldirilgan maydonlar.
  Map<String, String> toJson() => {
        if (entrance != null) 'entrance': entrance!,
        if (floor != null) 'floor': floor!,
        if (apartment != null) 'apartment': apartment!,
        if (intercom != null) 'intercom': intercom!,
        if (landmark != null) 'landmark': landmark!,
        if (courierNote != null) 'courierNote': courierNote!,
      };

  @override
  List<Object?> get props =>
      [entrance, floor, apartment, intercom, landmark, courierNote];
}
