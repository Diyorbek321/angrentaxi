import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/shared/models/service_city.dart';
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

/// Ilova bilgan xizmat hududlari to'plami va ular haqidagi barcha qarorlar.
///
/// O'zgarmas (immutable) qiymat obyekti: yangi ro'yxat kelganda mavjud
/// nusxa o'zgartirilmaydi, YANGISI quriladi. Shu sabab uni sof funksiya
/// kabi sinash mumkin — tarmoq ham, `BuildContext` ham kerak emas.
@immutable
class CityCoverage {
  const CityCoverage(this.cities);

  /// Qamrov haqida MA'LUMOT YO'Q holati: so'rov hali ketmagan, yiqilgan
  /// yoki server bo'sh ro'yxat qaytargan. Uchalasi ham bir xil ma'noga
  /// ega — cheklov yo'q.
  static const CityCoverage empty = CityCoverage(<ServiceCity>[]);

  /// `GET /cities` javobidan quradi.
  ///
  /// Ikkala shaklni ham qabul qiladi: o'ralgan `{success, data: [...]}` va
  /// sof massiv `[...]` — mobil tomon server konvensiyasining o'zgarishidan
  /// qulab tushmasligi kerak.
  factory CityCoverage.fromResponse(dynamic body) {
    final raw = body is Map<String, dynamic> ? body['data'] : body;
    if (raw is! List) return empty;

    final parsed = <ServiceCity>[];
    for (final item in raw) {
      if (item is! Map<String, dynamic>) continue;
      // Faol emas shahar qamrovga kirmaydi. Maydon umuman bo'lmasa faol
      // deb olinadi — ommaviy `GET /cities` allaqachon faqat faollarni
      // qaytaradi, bu esa qo'shimcha darvoza.
      if (item['isActive'] == false) continue;
      try {
        parsed.add(ServiceCity.fromJson(item));
      } catch (e) {
        // ⚠️ Bitta buzuq element butun qamrovni yo'q qilmasligi kerak:
        // qolgan shaharlar baribir ishlaydi. Sabab jurnalga yoziladi —
        // jimgina yutilmaydi.
        debugPrint('[CityCoverage] shahar elementi tushunilmadi: $e');
      }
    }
    // Tartib SERVERDAN keladi (`sortOrder`) — mobil tomon uni qayta
    // saralamaydi, ya'ni "birinchi shahar" serverning qarori.
    return CityCoverage(List<ServiceCity>.unmodifiable(parsed));
  }

  final List<ServiceCity> cities;

  bool get hasData => cities.isNotEmpty;

  /// ⚠️ HIMOYA (a): birorta shahar sozlanmagan bo'lsa HECH NARSA rad
  /// etilmaydi. Bo'sh sozlama = cheklov yo'q. So'rov yiqilganda ham
  /// ro'yxat bo'sh qoladi, ya'ni ilova avvalgidek ishlaydi — qamrov
  /// ma'lumotining yo'qligi buyurtma berishga to'sqinlik QILMAYDI.
  bool isServiceable(double lat, double lng) =>
      !hasData || cities.any((city) => city.contains(lat, lng));

  bool isOutside(double lat, double lng) => !isServiceable(lat, lng);

  /// Nuqtaga eng yaqin shahar — "Eng yaqin xizmat hududi: Angren" xabari
  /// uchun. Ma'lumot bo'lmasa `null`.
  ServiceCity? nearestTo(double lat, double lng) {
    if (!hasData) return null;
    return cities.reduce(
      (a, b) => a.distanceKmTo(lat, lng) <= b.distanceKmTo(lat, lng) ? a : b,
    );
  }

  /// Ro'yxatdagi birinchi (serverning tartibi bo'yicha asosiy) shahar.
  ServiceCity? get primary => hasData ? cities.first : null;

  /// Xarita ZAXIRA markazi: birinchi faol shaharning markazi.
  ///
  /// Shaharlar hali yuklanmagan bo'lsa `AppConfig` dagi qiymat zaxira
  /// bo'lib qoladi — ilova koordinatasiz xaritani umuman ocha olmaydi.
  LatLng get fallbackCenter =>
      primary?.center ?? const LatLng(AppConfig.defaultLat, AppConfig.defaultLng);
}
