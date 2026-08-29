import 'package:equatable/equatable.dart';

// ============================================================================
// TALAB ZONALARI — GET /surge/zones javobining modeli.
//
// Backend GeoJSON qaytaradi, LEKIN sof holida emas — global javob
// interceptor'i uni konvertga o'raydi, ya'ni simdan keladigan haqiqiy tana:
//   { success: true, data: { type: "FeatureCollection", features: [...] } }
// Shuning uchun `data` ni ochish MAJBURIY qadam (pastdagi `_unwrap`), ehtiyot
// chorasi emas. Har bir `properties` da uchta maydon bo'ladi: `zone`
// (h3 indeks), `level` ("normal" | "elevated" | "high") va `multiplier`.
//
// ⚠️ MAHSULOT QARORI: `multiplier` EKRANGA CHIQMAYDI. Haydovchi aniq
// koeffitsiyentni ko'rsa, u ko'tarilishini kutib bo'sh turadi — taklif
// kamayadi, yo'lovchining kutish vaqti oshadi. Shuning uchun bu model
// koeffitsiyentni UMUMAN saqlamaydi: ko'rsatib bo'lmaydigan narsa
// modelda yo'q bo'lsa, uni tasodifan chiqarib yuborish ham mumkin emas.
// Koeffitsiyent faqat backend loglarida/tahlilida qoladi.
// ============================================================================

/// Zonadagi talab darajasi. Chegaralarni backend hisoblaydi
/// (multiplier < 1.2 → normal, < 1.6 → elevated, aks holda high) —
/// mobil tomon faqat tayyor yorliqni o'qiydi, qayta hisoblamaydi.
enum DemandLevel { normal, elevated, high }

/// Noma'lum yoki yo'q qiymat `normal` ga tushadi: yangi daraja qo'shilsa
/// ekran "hammasi issiq" deb yolg'on ko'rsatgandan ko'ra, jim turgani
/// yaxshiroq.
DemandLevel demandLevelFromApi(Object? value) => switch (value) {
      'high' => DemandLevel.high,
      'elevated' => DemandLevel.elevated,
      _ => DemandLevel.normal,
    };

String demandLevelToApi(DemandLevel level) => switch (level) {
      DemandLevel.high => 'high',
      DemandLevel.elevated => 'elevated',
      DemandLevel.normal => 'normal',
    };

/// Bitta olti burchakli zona (h3 katak).
class DemandZone extends Equatable {
  const DemandZone({
    required this.zone,
    required this.level,
    required this.ring,
  });

  /// h3 indeks — zonaning barqaror identifikatori.
  final String zone;

  final DemandLevel level;

  /// Poligonning tashqi halqasi, GeoJSON tartibida: `[lng, lat]`.
  /// (Ilovaning qolgan qismidagi `LatLng` tartibi TESKARI — shuning uchun
  /// bu maydon xom holida saqlanadi va faqat xaritaga uzatiladi.)
  final List<List<double>> ring;

  /// Bitta `Feature` dan zona. Noto'g'ri/tushunarsiz feature `null` beradi —
  /// bitta buzuq katak butun ekranni yiqitmasligi kerak.
  static DemandZone? fromFeature(Object? feature) {
    if (feature is! Map<String, dynamic>) return null;

    final properties = feature['properties'];
    if (properties is! Map<String, dynamic>) return null;

    final zone = properties['zone'];
    if (zone is! String || zone.isEmpty) return null;

    final geometry = feature['geometry'];
    if (geometry is! Map<String, dynamic>) return null;
    if (geometry['type'] != 'Polygon') return null;

    final coordinates = geometry['coordinates'];
    if (coordinates is! List || coordinates.isEmpty) return null;

    final ring = _parseRing(coordinates.first);
    // Poligon uchun kamida uchta nuqta kerak; kamrog'i xaritada hech narsa
    // chizmaydi, lekin native tomonda ogohlantirish beradi.
    if (ring.length < 3) return null;

    return DemandZone(
      zone: zone,
      level: demandLevelFromApi(properties['level']),
      ring: ring,
    );
  }

  static List<List<double>> _parseRing(Object? raw) {
    if (raw is! List) return const [];
    final ring = <List<double>>[];
    for (final point in raw) {
      if (point is! List || point.length < 2) continue;
      final lng = point[0];
      final lat = point[1];
      if (lng is! num || lat is! num) continue;
      ring.add([lng.toDouble(), lat.toDouble()]);
    }
    return ring;
  }

  /// Xaritaga beriladigan `Feature`. `properties` da FAQAT `level` bor —
  /// yuqoridagi mahsulot qarorining texnik kafolati.
  Map<String, dynamic> toMapFeature() => {
        'type': 'Feature',
        'properties': {'level': demandLevelToApi(level)},
        'geometry': {
          'type': 'Polygon',
          'coordinates': [ring],
        },
      };

  @override
  List<Object?> get props => [zone, level, ring];
}

/// Bir so'rovda qaytgan zonalar to'plami + xarita uchun tayyor GeoJSON.
class DemandZones {
  DemandZones(List<DemandZone> zones)
      // `normal` zonalar bu yerdayoq tashlanadi: ular xaritada baribir
      // ko'rinmaydi (shaffof), lekin native tomonga yuz dona ortiqcha
      // poligon uzatish har yangilanishda bekorga ish.
      : zones = List.unmodifiable(
          zones.where((z) => z.level != DemandLevel.normal),
        );

  /// Bo'sh javob — provayderning boshlang'ich holati.
  static final DemandZones empty = DemandZones(const []);

  /// Faqat `elevated` va `high` zonalar.
  final List<DemandZone> zones;

  /// Javob GeoJSON `FeatureCollection` dan.
  ///
  /// Haqiqiy javob HAR DOIM `{ success, data }` konvertida keladi (backenddagi
  /// global `ResponseInterceptor`), shuning uchun `_unwrap` ni "ortiqcha
  /// himoya" deb o'ylab olib tashlash ekranni darhol bo'sh qoldiradi.
  /// Konvertsiz sof `FeatureCollection` ham qabul qilinadi — shunda bu model
  /// interceptor kelajakda o'chirilsa ham ishlayveradi.
  factory DemandZones.fromResponse(Object? body) {
    final json = _unwrap(body);
    if (json == null) return DemandZones(const []);

    final features = json['features'];
    if (features is! List) return DemandZones(const []);

    final parsed = <DemandZone>[];
    for (final feature in features) {
      final zone = DemandZone.fromFeature(feature);
      if (zone != null) parsed.add(zone);
    }
    return DemandZones(parsed);
  }

  static Map<String, dynamic>? _unwrap(Object? body) {
    if (body is! Map<String, dynamic>) return null;
    if (body['features'] is List) return body;
    final inner = body['data'];
    if (inner is Map<String, dynamic>) return inner;
    return null;
  }

  int get highCount =>
      zones.where((z) => z.level == DemandLevel.high).length;

  int get elevatedCount =>
      zones.where((z) => z.level == DemandLevel.elevated).length;

  /// Hech qayerda talab yuqori emasmi — "bo'sh holat" shartisi.
  bool get isEmpty => zones.isEmpty;

  /// Xarita manbasiga beriladigan GeoJSON.
  ///
  /// Bir marta qurilib saqlanadi (`late final`): `AppVectorMap` yangi
  /// ma'lumot kelganini AYNI SHU obyekt almashganidan biladi
  /// (`identical`). Har `build` da yangi Map qursak, xarita manbasi har
  /// kadrda bekorga qayta yozilardi.
  late final Map<String, dynamic> mapGeoJson = {
    'type': 'FeatureCollection',
    'features': [for (final zone in zones) zone.toMapFeature()],
  };
}
