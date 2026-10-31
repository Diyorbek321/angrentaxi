import 'dart:math' as math;

import 'package:equatable/equatable.dart';

/// Tumanlar, "mos/aylanma" belgisi va haydovchi bekatlar rejasi — backend
/// migratsiya 039 (`intercity-zone-policy.ts`, `intercity-fit.service.ts`,
/// `intercity-route-plan.service.ts`).
///
/// ⚠️ NOMI `District`: `IntercityZone` allaqachon nuqtaga nisbatan joy
/// (radius ichi / davom / tashqari) uchun band.

double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int? _intOrNull(dynamic v) => v is num ? v.toInt() : int.tryParse('$v');
String? _str(dynamic v) {
  if (v == null) return null;
  final s = v.toString().trim();
  return s.isEmpty ? null : s;
}

List<String> _strings(dynamic raw) => raw is List
    ? raw.map((e) => '$e').where((e) => e.isNotEmpty).toList(growable: false)
    : const [];

/// Nuqta atrofidagi tuman (Yunusobod, Chilonzor...) — markaz + radius.
class IntercityDistrict extends Equatable {
  const IntercityDistrict({
    required this.id,
    required this.name,
    this.centerLat = 0,
    this.centerLng = 0,
    this.radiusKm = 0,
  });

  factory IntercityDistrict.fromJson(Map<String, dynamic> json) => IntercityDistrict(
        id: '${json['id']}',
        name: '${json['name'] ?? ''}',
        centerLat: _num(json['centerLat']),
        centerLng: _num(json['centerLng']),
        radiusKm: _num(json['radiusKm']),
      );

  final String id;
  final String name;
  final double centerLat;
  final double centerLng;
  final double radiusKm;

  bool contains(double lat, double lng) {
    double rad(double d) => d * math.pi / 180;
    final dLat = rad(lat - centerLat);
    final dLng = rad(lng - centerLng);
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(rad(centerLat)) * math.cos(rad(lat)) * math.sin(dLng / 2) * math.sin(dLng / 2);
    return 6371 * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)) <= radiusKm;
  }

  @override
  List<Object?> get props => [id, name, centerLat, centerLng, radiusKm];
}

List<IntercityDistrict> intercityDistrictsFromJson(dynamic raw) => raw is List
    ? raw
        .whereType<Map>()
        .map((e) => IntercityDistrict.fromJson(Map<String, dynamic>.from(e)))
        .toList(growable: false)
    : const [];

/// Qidiruvda yo'lovchi manzili berilganda qatnov unga mosmi.
abstract final class IntercityFitKind {
  static const ok = 'ok';
  static const outOfZone = 'out_of_zone';
  static const detour = 'detour';
}

class IntercityTripFit extends Equatable {
  const IntercityTripFit({
    required this.fit,
    this.addedMinutes,
    this.detourChecked = true,
    this.zoneNames = const [],
  });

  static IntercityTripFit? fromJson(dynamic raw) {
    if (raw is! Map) return null;
    final json = Map<String, dynamic>.from(raw);
    return IntercityTripFit(
      fit: _str(json['fit']) ?? IntercityFitKind.ok,
      addedMinutes: _intOrNull(json['addedMinutes']),
      detourChecked: json['detourChecked'] != false,
      zoneNames: _strings(json['zoneNames']),
    );
  }

  final String fit;
  final int? addedMinutes;

  /// false — marshrut xizmati javob bermadi; "mos" deb ko'rsatiladi.
  final bool detourChecked;

  /// `out_of_zone` da — qatnov boradigan tumanlar.
  final List<String> zoneNames;

  bool get isOk => fit == IntercityFitKind.ok;
  bool get isOutOfZone => fit == IntercityFitKind.outOfZone;
  bool get isDetour => fit == IntercityFitKind.detour;

  @override
  List<Object?> get props => [fit, addedMinutes, detourChecked, zoneNames];
}

/// Quote'dagi moslik: band qilishdan oldin ogohlantirish uchun.
class IntercityQuoteFit extends Equatable {
  const IntercityQuoteFit({
    this.zoneOk = true,
    this.outOfZoneSide,
    this.zoneNames = const [],
    this.detourMinutes,
    this.detourChecked = true,
    this.detourTooLong = false,
    this.maxDetourMinutes = 0,
  });

  factory IntercityQuoteFit.fromJson(Map<String, dynamic> json) {
    final out = json['outOfZone'];
    final outMap = out is Map ? Map<String, dynamic>.from(out) : const <String, dynamic>{};
    return IntercityQuoteFit(
      zoneOk: json['zoneOk'] != false,
      outOfZoneSide: _str(outMap['side']),
      zoneNames: _strings(outMap['zoneNames']),
      detourMinutes: _intOrNull(json['detourMinutes']),
      detourChecked: json['detourChecked'] != false,
      detourTooLong: json['detourTooLong'] == true,
      maxDetourMinutes: _intOrNull(json['maxDetourMinutes']) ?? 0,
    );
  }

  static const ok = IntercityQuoteFit();

  final bool zoneOk;

  /// `origin` (olish) yoki `destination` (tushirish).
  final String? outOfZoneSide;
  final List<String> zoneNames;
  final int? detourMinutes;
  final bool detourChecked;
  final bool detourTooLong;
  final int maxDetourMinutes;

  /// Band baribir rad etiladi — tasdiqlash tugmasi o'chiq bo'lishi kerak.
  bool get blocksBooking => !zoneOk || detourTooLong;

  @override
  List<Object?> get props =>
      [zoneOk, outOfZoneSide, zoneNames, detourMinutes, detourChecked, detourTooLong, maxDetourMinutes];
}

/// Haydovchi bekatlar rejasi — `GET /intercity/trips/:id/route-plan`.
class IntercityRouteStop extends Equatable {
  const IntercityRouteStop({
    required this.sequence,
    required this.orderId,
    required this.kind,
    this.address,
    required this.lat,
    required this.lng,
    this.etaMinutesFromPrev,
  });

  factory IntercityRouteStop.fromJson(Map<String, dynamic> json) => IntercityRouteStop(
        sequence: _intOrNull(json['sequence']) ?? 0,
        orderId: '${json['orderId']}',
        kind: _str(json['kind']) ?? 'pickup',
        address: _str(json['address']),
        lat: _num(json['lat']),
        lng: _num(json['lng']),
        etaMinutesFromPrev: _intOrNull(json['etaMinutesFromPrev']),
      );

  final int sequence;
  final String orderId;

  /// `pickup` yoki `dropoff`.
  final String kind;
  final String? address;
  final double lat;
  final double lng;
  final int? etaMinutesFromPrev;

  @override
  List<Object?> get props => [sequence, orderId, kind, address, lat, lng, etaMinutesFromPrev];
}

class IntercityRoutePlan extends Equatable {
  const IntercityRoutePlan({
    required this.phase,
    required this.pointName,
    required this.stops,
    this.terminalEtaMinutes,
    this.totalMinutes,
    this.optimized = true,
  });

  factory IntercityRoutePlan.fromJson(Map<String, dynamic> json) {
    final point = json['point'];
    final stops = json['stops'];
    return IntercityRoutePlan(
      phase: _str(json['phase']) ?? 'done',
      pointName: point is Map ? '${point['name'] ?? ''}' : '',
      stops: stops is List
          ? stops
              .whereType<Map>()
              .map((e) => IntercityRouteStop.fromJson(Map<String, dynamic>.from(e)))
              .toList(growable: false)
          : const [],
      terminalEtaMinutes: _intOrNull(json['terminalEtaMinutes']),
      totalMinutes: _intOrNull(json['totalMinutes']),
      optimized: json['optimized'] != false,
    );
  }

  final String phase;
  final String pointName;
  final List<IntercityRouteStop> stops;
  final int? terminalEtaMinutes;
  final int? totalMinutes;

  /// false — marshrut xizmatisiz "eng yaqindan" tartib, vaqtlarsiz.
  final bool optimized;

  /// Buyurtma → tartib raqami (1 dan).
  Map<String, IntercityRouteStop> get byOrderId => {for (final stop in stops) stop.orderId: stop};

  @override
  List<Object?> get props => [phase, pointName, stops, terminalEtaMinutes, totalMinutes, optimized];
}
