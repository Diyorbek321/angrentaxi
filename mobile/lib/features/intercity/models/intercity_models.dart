import 'dart:math' as math;

import 'package:equatable/equatable.dart';

// ============================================================================
// SHAHARLARARO — server modellari (backend/src/modules/intercity/*-view.ts).
//
// Yo'lovchi va haydovchi oqimlari BIR XIL modellardan foydalanadi: haydovchi
// e'lon qilgan qatnov yo'lovchi ro'yxatida aynan shu shaklda keladi.
//
// ⚠️ Holat va tur qiymatlari enum EMAS, satr: server kelajakda yangi holat
// qo'shsa (masalan "paused"), eski APK yiqilmasligi kerak — noma'lum holat
// shunchaki "faol emas" deb talqin qilinadi.
// ============================================================================

abstract final class IntercityTripClass {
  static const start = 'start';
  static const comfort = 'comfort';
}

abstract final class IntercityBookingKind {
  static const seat = 'seat';
  static const wholeCar = 'whole_car';
}

abstract final class IntercityTripStatus {
  static const open = 'open';
  static const full = 'full';
  static const boarding = 'boarding';
  static const inProgress = 'in_progress';
  static const completed = 'completed';
  static const cancelled = 'cancelled';
}

/// Toshkent vaqti UTC+5, yozgi vaqt yo'q. Qatnov vaqti qurilma soat
/// mintaqasidan qat'i nazar Toshkent bo'yicha ko'rsatiladi — chet elda
/// turgan yo'lovchi ham "07:00" ni Angrendagi 07:00 deb tushunadi.
const Duration kTashkentOffset = Duration(hours: 5);

DateTime toTashkent(DateTime instant) => instant.toUtc().add(kTashkentOffset);

/// Server `?date=` kutadigan Toshkent kuni (YYYY-MM-DD).
String tashkentDateKey(DateTime instant) {
  final t = toTashkent(instant);
  String two(int v) => v.toString().padLeft(2, '0');
  return '${t.year}-${two(t.month)}-${two(t.day)}';
}

/// Bugundan boshlab [count] ta Toshkent kuni.
List<String> upcomingTashkentDays(DateTime now, {int count = 7}) => [
      for (var i = 0; i < count; i++)
        tashkentDateKey(now.toUtc().add(Duration(days: i))),
    ];

double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int _int(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
String? _str(dynamic v) {
  if (v == null) return null;
  final s = v.toString().trim();
  return s.isEmpty ? null : s;
}

/// Yo'nalish uchi — markaz va radius (masalan "Rohat krugi", r = 1.5 km).
class IntercityPoint extends Equatable {
  const IntercityPoint({
    required this.id,
    required this.name,
    required this.centerLat,
    required this.centerLng,
    required this.radiusKm,
  });

  factory IntercityPoint.fromJson(Map<String, dynamic> json) => IntercityPoint(
        id: '${json['id']}',
        name: '${json['name'] ?? ''}',
        centerLat: _num(json['centerLat']),
        centerLng: _num(json['centerLng']),
        radiusKm: _num(json['radiusKm']),
      );

  /// Shu radiusdan kichik nuqta — shahar emas, qat'iy TO'XTASH JOYI
  /// (aylanma, bekat). U yerda manzil tanlatish ma'nosiz: yo'lovchi aynan
  /// o'sha joyda tushadi, shahar ichiga kirish alohida hisoblanadi.
  static const double fixedStandMaxRadiusKm = 2;

  final String id;
  final String name;
  final double centerLat;
  final double centerLng;
  final double radiusKm;

  bool get isFixedStand => radiusKm <= fixedStandMaxRadiusKm;

  /// Server bilan bir xil qoida (`intercity-geo.ts`, haversine).
  bool contains(double lat, double lng) =>
      haversineKm(centerLat, centerLng, lat, lng) <= radiusKm;

  @override
  List<Object?> get props => [id, name, centerLat, centerLng, radiusKm];
}

double haversineKm(double lat1, double lng1, double lat2, double lng2) {
  const earthRadiusKm = 6371.0;
  double rad(double d) => d * math.pi / 180;
  final dLat = rad(lat2 - lat1);
  final dLng = rad(lng2 - lng1);
  final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
      math.cos(rad(lat1)) *
          math.cos(rad(lat2)) *
          math.sin(dLng / 2) *
          math.sin(dLng / 2);
  return earthRadiusKm * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

class IntercityRoute extends Equatable {
  const IntercityRoute({
    required this.id,
    required this.origin,
    required this.destination,
    required this.seatPrice,
    required this.wholeCarPrice,
    this.comfortSeatPrice,
    this.comfortWholeCarPrice,
    this.seatsDefault = 4,
  });

  factory IntercityRoute.fromJson(Map<String, dynamic> json) {
    final comfort = json['comfort'];
    return IntercityRoute(
      id: '${json['id']}',
      origin: IntercityPoint.fromJson(
          Map<String, dynamic>.from(json['origin'] as Map)),
      destination: IntercityPoint.fromJson(
          Map<String, dynamic>.from(json['destination'] as Map)),
      seatPrice: _num(json['seatPrice']),
      wholeCarPrice: _num(json['wholeCarPrice']),
      comfortSeatPrice: comfort is Map ? _num(comfort['seatPrice']) : null,
      comfortWholeCarPrice:
          comfort is Map ? _num(comfort['wholeCarPrice']) : null,
      seatsDefault: _int(json['seatsDefault'] ?? 4),
    );
  }

  final String id;
  final IntercityPoint origin;
  final IntercityPoint destination;
  final double seatPrice;
  final double wholeCarPrice;
  final double? comfortSeatPrice;
  final double? comfortWholeCarPrice;
  final int seatsDefault;

  bool get hasComfort => comfortSeatPrice != null;

  @override
  List<Object?> get props => [id, origin, destination, seatPrice, wholeCarPrice];
}

class IntercityTripDriver extends Equatable {
  const IntercityTripDriver({
    this.firstName,
    this.rating = 0,
    this.carModel,
    this.plate,
  });

  factory IntercityTripDriver.fromJson(Map<String, dynamic> json) =>
      IntercityTripDriver(
        firstName: _str(json['firstName']),
        rating: _num(json['rating']),
        carModel: _str(json['carModel']),
        plate: _str(json['plate']),
      );

  final String? firstName;
  final double rating;
  final String? carModel;
  final String? plate;

  @override
  List<Object?> get props => [firstName, rating, carModel, plate];
}

class IntercityTrip extends Equatable {
  const IntercityTrip({
    required this.id,
    required this.routeId,
    required this.originName,
    required this.destinationName,
    required this.tripClass,
    required this.departureAt,
    required this.status,
    required this.seatsTotal,
    required this.seatsLeft,
    required this.wholeCarAvailable,
    this.wholeCarBooked = false,
    required this.seatPrice,
    required this.wholeCarPrice,
    this.driver,
    this.cancelReason,
  });

  factory IntercityTrip.fromJson(Map<String, dynamic> json) {
    final route = json['route'] is Map
        ? Map<String, dynamic>.from(json['route'] as Map)
        : const <String, dynamic>{};
    String nameOf(String key) =>
        route[key] is Map ? '${(route[key] as Map)['name'] ?? ''}' : '';
    final driver = json['driver'];
    return IntercityTrip(
      id: '${json['id']}',
      routeId: '${route['id'] ?? ''}',
      originName: nameOf('origin'),
      destinationName: nameOf('destination'),
      tripClass: _str(json['tripClass']) ?? IntercityTripClass.start,
      departureAt: DateTime.parse('${json['departureAt']}').toUtc(),
      status: _str(json['status']) ?? IntercityTripStatus.open,
      seatsTotal: _int(json['seatsTotal']),
      seatsLeft: _int(json['seatsLeft']),
      wholeCarAvailable: json['wholeCarAvailable'] == true,
      wholeCarBooked: json['wholeCarBooked'] == true,
      seatPrice: _num(json['seatPrice']),
      wholeCarPrice: _num(json['wholeCarPrice']),
      driver: driver is Map
          ? IntercityTripDriver.fromJson(Map<String, dynamic>.from(driver))
          : null,
      cancelReason: _str(json['cancelReason']),
    );
  }

  final String id;
  final String routeId;
  final String originName;
  final String destinationName;
  final String tripClass;
  final DateTime departureAt;
  final String status;
  final int seatsTotal;
  final int seatsLeft;
  final bool wholeCarAvailable;

  /// Butun mashina olingan — o'rindiq sotilmaydi (`seatsLeft` 0).
  final bool wholeCarBooked;
  final double seatPrice;
  final double wholeCarPrice;
  final IntercityTripDriver? driver;
  final String? cancelReason;

  bool get isComfort => tripClass == IntercityTripClass.comfort;

  /// Band qilingan joylar. Server `seatsTaken` ni ommaviy ko'rinishda
  /// bermaydi; butun mashinada `seatsLeft` 0, ya'ni hisob baribir to'g'ri.
  int get seatsTaken => seatsTotal - seatsLeft;
  bool get isBookable => status == IntercityTripStatus.open && seatsLeft > 0;
  bool get isCancelled => status == IntercityTripStatus.cancelled;

  @override
  List<Object?> get props =>
      [id, status, seatsLeft, wholeCarAvailable, wholeCarBooked, departureAt, cancelReason];
}

/// Yo'lovchi bandi — server tomonda bitta `orders` qatori.
class IntercityBooking extends Equatable {
  const IntercityBooking({
    required this.orderId,
    required this.status,
    required this.price,
    this.bookingKind,
    this.seats,
    this.paymentMethod = 'cash',
    this.pickupAddress,
    this.dropoffAddress,
    this.cancelReason,
    this.trip,
    this.driverPhone,
  });

  factory IntercityBooking.fromJson(Map<String, dynamic> json) {
    final trip = json['trip'];
    return IntercityBooking(
      orderId: '${json['orderId']}',
      status: _str(json['status']) ?? 'scheduled',
      bookingKind: _str(json['bookingKind']),
      seats: json['seats'] == null ? null : _int(json['seats']),
      price: _num(json['price']),
      paymentMethod: _str(json['paymentMethod']) ?? 'cash',
      pickupAddress: _str(json['pickupAddress']),
      dropoffAddress: _str(json['dropoffAddress']),
      cancelReason: _str(json['cancelReason']),
      trip: trip is Map
          ? IntercityTrip.fromJson(Map<String, dynamic>.from(trip))
          : null,
      driverPhone: _str(json['driverPhone']),
    );
  }

  final String orderId;
  final String status;
  final String? bookingKind;
  final int? seats;
  final double price;
  final String paymentMethod;
  final String? pickupAddress;
  final String? dropoffAddress;
  final String? cancelReason;
  final IntercityTrip? trip;
  final String? driverPhone;

  bool get isWholeCar => bookingKind == IntercityBookingKind.wholeCar;
  bool get isCancelled => status == 'cancelled';
  bool get isFinished => status == 'completed' || isCancelled;

  /// Server qoidasi bilan bir xil: buyurtma hali SCHEDULED va qatnovda
  /// yig'ish boshlanmagan (open|full) bo'lsagina yo'lovchi bekor qila oladi.
  bool get isCancellable {
    final tripStatus = trip?.status;
    return status == 'scheduled' &&
        (tripStatus == IntercityTripStatus.open ||
            tripStatus == IntercityTripStatus.full);
  }

  @override
  List<Object?> get props => [orderId, status, price, trip, driverPhone];
}

double? _numOrNull(dynamic v) =>
    v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));

/// Haydovchi ko'radigan band (`GET /intercity/trips/:id/bookings`,
/// backend `intercity-booking-driver-view.ts`).
///
/// Koordinatalar — yo'lovchilarni eng yaqinidan boshlab yig'ish uchun.
/// Telefon server ochgandagina keladi (yig'ish boshlangan yoki jo'nashga
/// ≤60 daqiqa), aks holda `null`.
class IntercityDriverBooking extends Equatable {
  const IntercityDriverBooking({
    required this.orderId,
    required this.status,
    this.seats,
    this.bookingKind,
    required this.price,
    required this.passengerName,
    this.passengerPhone,
    this.pickupAddress,
    this.pickupLat,
    this.pickupLng,
    this.dropoffAddress,
    this.dropoffLat,
    this.dropoffLng,
  });

  factory IntercityDriverBooking.fromJson(Map<String, dynamic> json) {
    final passenger = json['passenger'];
    final p = passenger is Map ? passenger : const {};
    return IntercityDriverBooking(
      orderId: '${json['orderId']}',
      status: _str(json['status']) ?? 'scheduled',
      seats: json['seats'] == null ? null : _int(json['seats']),
      bookingKind: _str(json['bookingKind']),
      price: _num(json['price']),
      passengerName: _str(p['name']) ?? '',
      passengerPhone: _str(p['phone']),
      pickupAddress: _str(json['pickupAddress']),
      pickupLat: _numOrNull(json['pickupLat']),
      pickupLng: _numOrNull(json['pickupLng']),
      dropoffAddress: _str(json['dropoffAddress']),
      dropoffLat: _numOrNull(json['dropoffLat']),
      dropoffLng: _numOrNull(json['dropoffLng']),
    );
  }

  final String orderId;
  final String status;
  final int? seats;
  final String? bookingKind;
  final double price;
  final String passengerName;
  final String? passengerPhone;
  final String? pickupAddress;
  final double? pickupLat;
  final double? pickupLng;
  final String? dropoffAddress;
  final double? dropoffLat;
  final double? dropoffLng;

  bool get isWholeCar => bookingKind == IntercityBookingKind.wholeCar;

  /// Hali mashinada yoki olinishi kutilmoqda.
  bool get isLive =>
      status == 'scheduled' ||
      status == 'accepted' ||
      status == 'arrived' ||
      status == 'in_progress';

  bool get hasPickupPoint => pickupLat != null && pickupLng != null;

  @override
  List<Object?> get props => [orderId, status, price, passengerPhone];
}

/// `GET /settings/public` dagi shaharlararo qismi.
class IntercityPublicSettings extends Equatable {
  const IntercityPublicSettings({
    this.enabled = false,
    this.freeCancelMinutes = 60,
    this.maxSeatsPerBooking = 4,
    this.minLeadMinutes = 30,
    this.maxAheadDays = 7,
  });

  factory IntercityPublicSettings.fromJson(Map<String, dynamic> json) =>
      IntercityPublicSettings(
        enabled: json['intercityEnabled'] == true,
        freeCancelMinutes: json['intercityFreeCancelMinutes'] is num
            ? _int(json['intercityFreeCancelMinutes'])
            : 60,
        maxSeatsPerBooking: json['intercityMaxSeatsPerBooking'] is num
            ? _int(json['intercityMaxSeatsPerBooking'])
            : 4,
        minLeadMinutes: json['intercityMinLeadMinutes'] is num
            ? _int(json['intercityMinLeadMinutes'])
            : 30,
        maxAheadDays: json['intercityMaxAheadDays'] is num
            ? _int(json['intercityMaxAheadDays'])
            : 7,
      );

  static const disabled = IntercityPublicSettings();

  final bool enabled;
  final int freeCancelMinutes;
  final int maxSeatsPerBooking;

  /// Haydovchi e'loni: jo'nash kamida shuncha daqiqa keyin bo'lishi kerak.
  final int minLeadMinutes;

  /// Haydovchi e'loni: jo'nash ko'pi bilan shuncha kun oldin.
  final int maxAheadDays;

  @override
  List<Object?> get props =>
      [enabled, freeCancelMinutes, maxSeatsPerBooking, minLeadMinutes, maxAheadDays];
}
