import 'package:latlong2/latlong.dart';

// ============================================================================
// MARSHRUT QADAMI (turn-by-turn)
//
// OSRM `steps=true` bilan so'ralganda har bir `legs[].steps[]` elementi
// BITTA manevrni va undan keyingi yo'l bo'lagini tasvirlaydi:
//
//   step[i] = "manevr (maneuver.location da) + keyingi manevrgacha
//              `distance` metr `name` ko'chasi bo'ylab yurish"
//
// Ya'ni haydovchi step[i] bo'ylab ketayotganda uning oldida turgan manevr —
// step[i+1] ning manevri. NavigationEngine aynan shu munosabatga tayanadi;
// shuning uchun bu yerda qadamlar OSRM bergan tartibda, hech qanday
// "siljitish" (shift) qilinmasdan saqlanadi.
//
// Nega o'z enum'imiz bor, xom satr emas: OSRM matnlari ("slight right")
// bevosita UI'ga ham, o'zbekcha iboraga ham mos kelmaydi. Enum bo'lsa
// `maneuver_phrases.dart` va ikonka jadvali `switch` da TO'LIQ bo'ladi —
// yangi tur qo'shilsa analizator eslatadi.
// ============================================================================

/// OSRM `maneuver.type` — nima qilish kerakligi.
enum ManeuverType {
  /// Marshrut boshlanishi.
  depart,

  /// Oddiy burilish (chorrahada).
  turn,

  /// Yo'l nomi o'zgardi, lekin burilish yo'q.
  newName,

  /// To'g'ri davom etish (OSRM'da `continue`).
  straightOn,

  /// Yo'lga qo'shilish (qatorga kirish).
  merge,

  /// Magistralga kirish yo'lkasi.
  onRamp,

  /// Magistraldan chiqish yo'lkasi.
  offRamp,

  /// Yo'l ikkiga ayrilishi.
  fork,

  /// Yo'l tugadi — majburiy burilish.
  endOfRoad,

  /// Aylanma yo'lga kirish.
  roundabout,

  /// Katta aylanma (rotary).
  rotary,

  /// Aylanma ichidagi burilish.
  roundaboutTurn,

  /// Aylanmadan chiqish.
  exitRoundabout,

  /// Katta aylanmadan chiqish.
  exitRotary,

  /// Yo'l xususiyati o'zgardi (ogohlantirish), harakat talab qilinmaydi.
  notification,

  /// Manzilga yetib kelish.
  arrive,

  /// OSRM kelajakda yangi tur qo'shsa — ilova yiqilmasligi uchun.
  unknown,
}

/// OSRM `maneuver.modifier` — qaysi tomonga.
enum ManeuverModifier {
  uturn,
  sharpRight,
  right,
  slightRight,
  straight,
  slightLeft,
  left,
  sharpLeft,

  /// OSRM modifikator bermagan (masalan ba'zi `depart`/`arrive` qadamlari).
  none,
}

/// Bitta manevr + undan keyingi yo'l bo'lagi.
class RouteStep {
  const RouteStep({
    required this.type,
    required this.modifier,
    required this.location,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.name,
    this.exit,
  });

  /// Manevr turi.
  final ManeuverType type;

  /// Manevr yo'nalishi.
  final ManeuverModifier modifier;

  /// Manevr AYNAN qayerda bajariladi (OSRM `maneuver.location`, [lng, lat]
  /// tartibida keladi va bu yerda LatLng ga aylantiriladi).
  final LatLng location;

  /// Shu manevrdan KEYINGI manevrgacha yuriladigan masofa (metr).
  final double distanceMeters;

  /// Xuddi shu bo'lakning taxminiy vaqti (soniya) — qolgan vaqtni
  /// hisoblashda ishlatiladi.
  final double durationSeconds;

  /// Manevrdan keyin kiriladigan ko'cha nomi. OSRM nomni bilmasa bo'sh
  /// satr keladi — UI uni ko'rsatmaydi.
  final String name;

  /// Aylanma yo'lda nechanchi chiqish (OSRM `maneuver.exit`). Faqat
  /// roundabout/rotary qadamlarida bo'ladi.
  final int? exit;

  /// OSRM `legs[].steps[]` elementidan qadam quradi.
  ///
  /// Har bir maydon himoyalangan holda o'qiladi: OSRM'ning ba'zi
  /// profillari `name` yoki `modifier` ni umuman yubormaydi va bitta
  /// yo'q maydon butun navigatsiyani yiqitmasligi kerak.
  static RouteStep? fromOsrmJson(Map<String, dynamic> json) {
    final maneuver = json['maneuver'];
    if (maneuver is! Map<String, dynamic>) return null;

    final coordinates = maneuver['location'];
    if (coordinates is! List || coordinates.length < 2) return null;

    final lng = coordinates[0];
    final lat = coordinates[1];
    if (lng is! num || lat is! num) return null;

    return RouteStep(
      type: parseType(maneuver['type']),
      modifier: parseModifier(maneuver['modifier']),
      location: LatLng(lat.toDouble(), lng.toDouble()),
      distanceMeters: _toDouble(json['distance']),
      durationSeconds: _toDouble(json['duration']),
      name: json['name'] is String ? json['name'] as String : '',
      exit: maneuver['exit'] is num ? (maneuver['exit'] as num).toInt() : null,
    );
  }

  /// OSRM javobidagi BARCHA `legs` ning qadamlarini bitta ketma-ketlikka
  /// yig'adi.
  ///
  /// Nega birlashtiriladi: oraliq nuqtali (waypoint) buyurtmada OSRM
  /// marshrutni bir nechta `leg` ga bo'ladi, lekin haydovchi uchun bu
  /// bitta uzluksiz yo'l — panel ham, ovoz ham bo'linishni bilmasligi
  /// kerak.
  static List<RouteStep> fromOsrmLegs(List<dynamic>? legs) {
    if (legs == null) return const [];

    final steps = <RouteStep>[];
    for (final leg in legs) {
      if (leg is! Map<String, dynamic>) continue;
      final legSteps = leg['steps'];
      if (legSteps is! List) continue;
      for (final raw in legSteps) {
        if (raw is! Map<String, dynamic>) continue;
        final step = fromOsrmJson(raw);
        if (step != null) steps.add(step);
      }
    }
    return steps;
  }

  /// OSRM tur satrini enum'ga aylantiradi.
  static ManeuverType parseType(Object? raw) {
    switch (raw) {
      case 'depart':
        return ManeuverType.depart;
      case 'turn':
        return ManeuverType.turn;
      case 'new name':
        return ManeuverType.newName;
      case 'continue':
        return ManeuverType.straightOn;
      case 'merge':
        return ManeuverType.merge;
      case 'on ramp':
        return ManeuverType.onRamp;
      case 'off ramp':
        return ManeuverType.offRamp;
      case 'fork':
        return ManeuverType.fork;
      case 'end of road':
        return ManeuverType.endOfRoad;
      case 'roundabout':
        return ManeuverType.roundabout;
      case 'rotary':
        return ManeuverType.rotary;
      case 'roundabout turn':
        return ManeuverType.roundaboutTurn;
      case 'exit roundabout':
        return ManeuverType.exitRoundabout;
      case 'exit rotary':
        return ManeuverType.exitRotary;
      case 'notification':
        return ManeuverType.notification;
      case 'arrive':
        return ManeuverType.arrive;
      default:
        return ManeuverType.unknown;
    }
  }

  /// OSRM modifikator satrini enum'ga aylantiradi.
  static ManeuverModifier parseModifier(Object? raw) {
    switch (raw) {
      case 'uturn':
        return ManeuverModifier.uturn;
      case 'sharp right':
        return ManeuverModifier.sharpRight;
      case 'right':
        return ManeuverModifier.right;
      case 'slight right':
        return ManeuverModifier.slightRight;
      case 'straight':
        return ManeuverModifier.straight;
      case 'slight left':
        return ManeuverModifier.slightLeft;
      case 'left':
        return ManeuverModifier.left;
      case 'sharp left':
        return ManeuverModifier.sharpLeft;
      default:
        return ManeuverModifier.none;
    }
  }

  static double _toDouble(Object? raw) =>
      raw is num ? raw.toDouble() : 0;

  @override
  String toString() =>
      'RouteStep(${type.name}/${modifier.name}, '
      '${distanceMeters.toStringAsFixed(0)}m, "$name")';
}
