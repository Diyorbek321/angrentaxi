import 'package:equatable/equatable.dart';
import 'package:latlong2/latlong.dart';

/// Xizmat ko'rsatiladigan shahar — markaz nuqtasi va radius bilan berilgan
/// DOIRA (`GET /cities` javobining bitta elementi).
///
/// ⚠️ NEGA doira, poligon emas: O'zbek shaharlari uchun doira yetarlicha
/// aniq va uni bitta ekranda boshqarish oson (markaz + radius). Poligon
/// kerak bo'lganda faqat [contains] ning ichi o'zgaradi — bu yerdagi
/// interfeys o'zgarmaydi, ya'ni ekranlarga qaytadan tegilmaydi.
class ServiceCity extends Equatable {
  const ServiceCity({
    required this.id,
    required this.name,
    required this.centerLat,
    required this.centerLng,
    required this.radiusKm,
  });

  /// ⚠️ Maydon yetishmasa yoki turi noto'g'ri bo'lsa ATAYLAB otiladi.
  /// Yarim tushunilgan doira eng xavflisi: u xizmat hududida turgan
  /// odamni ham "hudud tashqarisida" deb bloklab qo'yishi mumkin. Bunday
  /// elementni chaqiruvchi (`CityCoverage.fromResponse`) butunlay tashlab
  /// yuboradi.
  factory ServiceCity.fromJson(Map<String, dynamic> json) {
    return ServiceCity(
      id: json['id'] as String,
      name: json['name'] as String,
      centerLat: (json['centerLat'] as num).toDouble(),
      centerLng: (json['centerLng'] as num).toDouble(),
      radiusKm: (json['radiusKm'] as num).toDouble(),
    );
  }

  final String id;
  final String name;
  final double centerLat;
  final double centerLng;

  /// Doira radiusi (km). Manfiy yoki nol qiymat shaharni "hech qayerni
  /// qamramaydi" holatiga tushiradi — bu server sozlamasining ishi, mobil
  /// tomon uni tuzatmaydi.
  final double radiusKm;

  LatLng get center => LatLng(centerLat, centerLng);

  /// Nuqtagacha bo'lgan to'g'ri chiziqli (haversine) masofa, km.
  double distanceKmTo(double lat, double lng) =>
      const Distance().as(LengthUnit.Kilometer, center, LatLng(lat, lng));

  /// Chegara nuqtasi ICHKARI deb hisoblanadi — chekkadagi uy tufayli
  /// buyurtma rad etilmasin.
  bool contains(double lat, double lng) => distanceKmTo(lat, lng) <= radiusKm;

  @override
  List<Object?> get props => [id, name, centerLat, centerLng, radiusKm];
}
