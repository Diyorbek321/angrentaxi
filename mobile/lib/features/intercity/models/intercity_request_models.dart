import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:equatable/equatable.dart';

// ============================================================================
// YO'LOVCHI SO'ROVLARI DOSKASI — server modellari
// (backend/src/modules/intercity/intercity-request-view.ts).
//
// Mos qatnov topilmasa yo'lovchi so'rov qoldiradi: yo'nalish, joylar va
// jo'nash ORALIG'I (masalan 14:00–16:00). Narx — yo'nalishning qat'iy
// tarifi + shahar ichiga davom; yo'lovchi uni faqat OSHIRA oladi. Haydovchi
// qabul qilsa band uning mos qatnoviga tushadi yoki yangi qatnov ochiladi.
// ============================================================================

abstract final class IntercityRequestStatus {
  static const open = 'open';
  static const accepted = 'accepted';
  static const cancelled = 'cancelled';
  static const expired = 'expired';
}

/// Server `INTERCITY_REQUEST_BONUS_STEP` — oshirish qadami (so'm).
const int kIntercityRequestBonusStep = 1000;

/// Server `INTERCITY_REQUEST_DEPARTURE_LEAD_MINUTES`: haydovchi eng erta
/// hozirdan shuncha keyin jo'nay oladi (yo'lovchi tayyorlanishi uchun).
const Duration kIntercityRequestDepartureLead = Duration(minutes: 10);

/// Server oralig'i chegaralari (`intercity-request-policy.ts`).
const Duration kIntercityRequestWindowMin = Duration(minutes: 30);
const Duration kIntercityRequestWindowMax = Duration(hours: 12);

double _num(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
int _int(dynamic v) => v is num ? v.toInt() : int.tryParse('$v') ?? 0;
String? _str(dynamic v) {
  if (v == null) return null;
  final s = v.toString().trim();
  return s.isEmpty ? null : s;
}

List<IntercityExtensionCharge> _extensions(dynamic raw) => raw is List
    ? raw
        .whereType<Map>()
        .map((e) => IntercityExtensionCharge.fromJson(Map<String, dynamic>.from(e)))
        .toList(growable: false)
    : const [];

class IntercityRequestPlace extends Equatable {
  const IntercityRequestPlace({required this.lat, required this.lng, required this.address});

  factory IntercityRequestPlace.fromJson(dynamic json) {
    final m = json is Map ? json : const {};
    return IntercityRequestPlace(
      lat: _num(m['lat']),
      lng: _num(m['lng']),
      address: '${m['address'] ?? ''}',
    );
  }

  final double lat;
  final double lng;
  final String address;

  @override
  List<Object?> get props => [lat, lng, address];
}

/// Yo'lovchi so'rovi — yo'lovchiga ham, haydovchi doskasiga ham bir xil
/// (yo'lovchi ismi/telefoni YO'Q: haydovchi ularni qabul qilgach band orqali ko'radi).
class IntercityRequest extends Equatable {
  const IntercityRequest({
    required this.id,
    required this.status,
    required this.routeId,
    required this.originName,
    required this.destinationName,
    required this.tripClass,
    required this.kind,
    required this.seats,
    required this.pickup,
    required this.dropoff,
    required this.windowStart,
    required this.windowEnd,
    required this.basePrice,
    this.extensions = const [],
    required this.bonus,
    required this.total,
    required this.maxBonus,
    this.bonusStep = kIntercityRequestBonusStep,
    this.tripId,
    this.orderId,
  });

  factory IntercityRequest.fromJson(Map<String, dynamic> json) => IntercityRequest(
        id: '${json['id']}',
        status: _str(json['status']) ?? IntercityRequestStatus.open,
        routeId: '${json['routeId'] ?? ''}',
        originName: '${json['originName'] ?? ''}',
        destinationName: '${json['destinationName'] ?? ''}',
        tripClass: _str(json['tripClass']) ?? IntercityTripClass.start,
        kind: _str(json['kind']) ?? IntercityBookingKind.seat,
        seats: _int(json['seats'] ?? 1),
        pickup: IntercityRequestPlace.fromJson(json['pickup']),
        dropoff: IntercityRequestPlace.fromJson(json['dropoff']),
        windowStart: DateTime.parse('${json['windowStart']}').toUtc(),
        windowEnd: DateTime.parse('${json['windowEnd']}').toUtc(),
        basePrice: _num(json['basePrice']),
        extensions: _extensions(json['extensions']),
        bonus: _num(json['bonus']),
        total: _num(json['total']),
        maxBonus: _num(json['maxBonus']),
        bonusStep: json['bonusStep'] is num ? _int(json['bonusStep']) : kIntercityRequestBonusStep,
        tripId: _str(json['tripId']),
        orderId: _str(json['orderId']),
      );

  final String id;
  final String status;
  final String routeId;
  final String originName;
  final String destinationName;
  final String tripClass;
  final String kind;
  final int seats;
  final IntercityRequestPlace pickup;
  final IntercityRequestPlace dropoff;
  final DateTime windowStart;
  final DateTime windowEnd;

  /// Qat'iy narx + davom (oshirishsiz); [total] = [basePrice] + [bonus].
  final double basePrice;
  final List<IntercityExtensionCharge> extensions;
  final double bonus;
  final double total;

  /// Oshirishning yuqori chegarasi (narx ko'pi bilan ikki barobar).
  final double maxBonus;
  final int bonusStep;

  /// Davomsiz qat'iy tarif ([basePrice] davomni ham o'z ichiga oladi).
  double get tariffPrice => basePrice - extensions.fold<double>(0, (sum, e) => sum + e.fare);

  /// Qabul qilingach — band tushgan qatnov va buyurtma.
  final String? tripId;
  final String? orderId;

  bool get isOpen => status == IntercityRequestStatus.open;
  bool get isAccepted => status == IntercityRequestStatus.accepted;
  bool get isWholeCar => kind == IntercityBookingKind.wholeCar;
  bool get isComfort => tripClass == IntercityTripClass.comfort;

  /// Yana bir qadam oshirish mumkinmi.
  bool get canRaise => isOpen && bonus + bonusStep <= maxBonus;

  /// Haydovchi eng erta jo'nay oladigan vaqt (server `departureFitsWindow`).
  DateTime earliestDeparture(DateTime now) {
    final lead = now.toUtc().add(kIntercityRequestDepartureLead);
    return lead.isAfter(windowStart) ? lead : windowStart;
  }

  /// Server qoidasi bilan bir xil: [earliestDeparture] .. [windowEnd].
  bool departureFits(DateTime departure, DateTime now) {
    final at = departure.toUtc();
    return !at.isBefore(earliestDeparture(now)) && !at.isAfter(windowEnd);
  }

  @override
  List<Object?> get props => [id, status, bonus, total, tripId, orderId, windowStart, windowEnd];
}

/// `POST /intercity/requests/quote` — saqlamasdan narx.
class IntercityRequestQuote extends Equatable {
  const IntercityRequestQuote({
    required this.seats,
    required this.basePrice,
    this.extensions = const [],
    required this.bonus,
    required this.total,
    required this.maxBonus,
  });

  factory IntercityRequestQuote.fromJson(Map<String, dynamic> json) => IntercityRequestQuote(
        seats: _int(json['seats'] ?? 1),
        basePrice: _num(json['basePrice']),
        extensions: _extensions(json['extensions']),
        bonus: _num(json['bonus']),
        total: _num(json['total']),
        maxBonus: _num(json['maxBonus']),
      );

  final int seats;
  final double basePrice;
  final List<IntercityExtensionCharge> extensions;
  final double bonus;
  final double total;
  final double maxBonus;

  /// Davomsiz qat'iy tarif ([basePrice] davomni ham o'z ichiga oladi).
  double get tariffPrice => basePrice - extensions.fold<double>(0, (sum, e) => sum + e.fare);

  @override
  List<Object?> get props => [seats, basePrice, extensions, bonus, total, maxBonus];
}

/// `POST /intercity/requests/:id/accept` javobi.
class IntercityRequestAcceptance extends Equatable {
  const IntercityRequestAcceptance({
    required this.request,
    required this.tripId,
    required this.orderId,
    required this.tripCreated,
  });

  factory IntercityRequestAcceptance.fromJson(Map<String, dynamic> json) => IntercityRequestAcceptance(
        request: IntercityRequest.fromJson(Map<String, dynamic>.from(json['request'] as Map)),
        tripId: '${json['tripId']}',
        orderId: '${json['orderId']}',
        tripCreated: json['tripCreated'] == true,
      );

  final IntercityRequest request;
  final String tripId;
  final String orderId;

  /// So'rov uchun yangi qatnov ochildi (qolgan joylar boshqalarga ochiq).
  final bool tripCreated;

  @override
  List<Object?> get props => [request, tripId, orderId, tripCreated];
}

/// Toshkent kuni (YYYY-MM-DD) va soat:daqiqa → UTC lahza.
DateTime tashkentInstant(String dateKey, int hour, int minute) {
  final parts = dateKey.split('-').map(int.parse).toList();
  return DateTime.utc(parts[0], parts[1], parts[2], hour, minute).subtract(kTashkentOffset);
}

/// Daqiqani [step] ga YUQORIGA yaxlitlash (soniyalarsiz).
DateTime ceilToMinutes(DateTime instant, int step) {
  final utc = instant.toUtc();
  final base = DateTime.utc(utc.year, utc.month, utc.day, utc.hour, utc.minute);
  final bumped = utc.isAfter(base) ? base.add(const Duration(minutes: 1)) : base;
  final remainder = bumped.minute % step;
  return remainder == 0 ? bumped : bumped.add(Duration(minutes: step - remainder));
}

/// Oraliqdagi muammo — server `evaluateRequestWindow` bilan bir xil
/// tartibda (ilova yuborishdan oldin aytadi; yakuniy hakam baribir server).
enum IntercityWindowProblem { invalid, tooShort, tooLong, tooSoon, tooFar }

/// Oraliq oxirigacha kamida shuncha qolishi kerak (server `MIN_REMAINING`).
const Duration kIntercityRequestMinRemaining = Duration(minutes: 30);

IntercityWindowProblem? intercityWindowProblem({
  required DateTime start,
  required DateTime end,
  required DateTime now,
  required int maxAheadDays,
}) {
  if (!end.isAfter(start)) return IntercityWindowProblem.invalid;
  final length = end.difference(start);
  if (length < kIntercityRequestWindowMin) return IntercityWindowProblem.tooShort;
  if (length > kIntercityRequestWindowMax) return IntercityWindowProblem.tooLong;
  if (end.isBefore(now.add(kIntercityRequestMinRemaining))) return IntercityWindowProblem.tooSoon;
  if (start.isAfter(now.add(Duration(days: maxAheadDays)))) return IntercityWindowProblem.tooFar;
  return null;
}

/// Haydovchining so'rovga mos qatnovlari — server `resolveTarget.fits`
/// bilan AYNAN bir xil: shu yo'nalish va klass, holati `open`, jo'nashi
/// oraliqda. ⚠️ Joy soni bu yerda TEKSHIRILMAYDI, chunki server ham
/// tekshirmaydi: `tripId` siz qabulda u birinchi mos qatnovni o'zi oladi.
/// Joyi yetmagan qatnovni yashirib "yangi vaqt" taklif qilsak, server
/// baribir o'sha qatnovni tanlab 409 qaytarardi. Joy — [intercityTripHasRoomFor].
List<IntercityTrip> intercityTripsForRequest(
  IntercityRequest request,
  Iterable<IntercityTrip> trips,
  DateTime now,
) =>
    [
      for (final trip in trips)
        if (trip.routeId == request.routeId &&
            trip.tripClass == request.tripClass &&
            trip.status == IntercityTripStatus.open &&
            request.departureFits(trip.departureAt, now))
          trip,
    ];

/// Qatnovda so'rovga yetarli joy bormi (yo'q bo'lsa server 409 qaytaradi).
bool intercityTripHasRoomFor(IntercityRequest request, IntercityTrip trip) =>
    request.isWholeCar ? trip.wholeCarAvailable : trip.seatsLeft >= request.seats;

/// Server `INTERCITY_OVERLAP_HOURS`: haydovchining ikki qatnovi orasida kamida shuncha.
const Duration kIntercityTripOverlap = Duration(hours: 3);

/// Yangi qatnov uchun jo'nash variantlari: eng erta vaqtdan oraliq oxirigacha
/// har [stepMinutes] daqiqada (ko'pi bilan [limit] ta). [busy] — haydovchining
/// jonli qatnovlari: ulardan ±3 soat ichidagi vaqt server tomonidan rad
/// etiladi (`INTERCITY_TRIP_OVERLAP`), shuning uchun taklif qilinmaydi.
List<DateTime> intercityDepartureSlots(
  IntercityRequest request,
  DateTime now, {
  Iterable<DateTime> busy = const [],
  int stepMinutes = 15,
  int limit = 48,
}) {
  final earliest = request.earliestDeparture(now);
  var slot = ceilToMinutes(earliest, stepMinutes);
  // Tor oraliq: yaxlitlangan vaqt oxiridan o'tib ketsa — eng erta daqiqa.
  if (slot.isAfter(request.windowEnd)) slot = ceilToMinutes(earliest, 1);
  bool free(DateTime at) => busy.every((other) => other.difference(at).abs() >= kIntercityTripOverlap);
  final slots = <DateTime>[];
  while (!slot.isAfter(request.windowEnd) && slots.length < limit) {
    if (free(slot)) slots.add(slot);
    slot = slot.add(Duration(minutes: stepMinutes));
  }
  return slots;
}

/// Haydovchi jonli qatnovlari (yangi qatnov ular bilan ±3 soat to'qnashmasin).
bool isLiveIntercityTrip(IntercityTrip trip) =>
    trip.status == IntercityTripStatus.open ||
    trip.status == IntercityTripStatus.full ||
    trip.status == IntercityTripStatus.boarding ||
    trip.status == IntercityTripStatus.inProgress;
