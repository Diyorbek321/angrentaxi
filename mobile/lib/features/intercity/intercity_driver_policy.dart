import 'package:angren_taxi/features/intercity/models/intercity_models.dart';

// ============================================================================
// SHAHARLARARO — haydovchi tomonidagi sof qoidalar.
//
// ⚠️ Server baribir HAMMASINI qayta tekshiradi (intercity-trip-policy.ts,
// intercity-lifecycle-policy.ts). Bu yerdagi nusxa faqat haydovchiga xatoni
// tarmoqqa chiqmasdan, DARHOL ko'rsatish va tugmani o'z vaqtida yashirish
// uchun. Ikkalasi farq qilib qolsa, server haq — ekran uning xatosini
// ko'rsatadi.
// ============================================================================

/// Yig'ish jo'nashdan shuncha oldin ochiladi (server bilan bir xil).
const Duration kIntercityBoardingOpensBefore = Duration(minutes: 60);

enum IntercityDepartureIssue { tooSoon, tooFar }

/// E'lon qilish mumkin bo'lgan jo'nash oralig'i.
class IntercityPublishWindow {
  const IntercityPublishWindow({required this.earliest, required this.latest});

  factory IntercityPublishWindow.from(
    DateTime now,
    IntercityPublicSettings settings,
  ) {
    final utc = now.toUtc();
    return IntercityPublishWindow(
      earliest: utc.add(Duration(minutes: settings.minLeadMinutes)),
      latest: utc.add(Duration(days: settings.maxAheadDays)),
    );
  }

  final DateTime earliest;
  final DateTime latest;

  IntercityDepartureIssue? check(DateTime departure) {
    final d = departure.toUtc();
    if (d.isBefore(earliest)) return IntercityDepartureIssue.tooSoon;
    if (d.isAfter(latest)) return IntercityDepartureIssue.tooFar;
    return null;
  }
}

const _liveStatuses = {
  IntercityTripStatus.open,
  IntercityTripStatus.full,
  IntercityTripStatus.boarding,
  IntercityTripStatus.inProgress,
};

bool isLiveTrip(IntercityTrip trip) => _liveStatuses.contains(trip.status);

/// "Yig'ishni boshlash": jo'nashdan 60 daqiqa oldin, to'la bo'lsa istalgan
/// payt — lekin kamida bitta band bo'lishi shart (bo'sh mashina bilan
/// yig'ishning ma'nosi yo'q, server ham rad etadi).
bool canStartBoarding(IntercityTrip trip, DateTime now) {
  final waiting = trip.status == IntercityTripStatus.open ||
      trip.status == IntercityTripStatus.full;
  if (!waiting || trip.seatsTaken == 0) return false;
  if (trip.status == IntercityTripStatus.full) return true;
  return !now
      .toUtc()
      .isBefore(trip.departureAt.subtract(kIntercityBoardingOpensBefore));
}

/// Yo'lga chiqqan qatnov bekor qilinmaydi — yo'lovchilar mashinada.
bool canCancelTrip(IntercityTrip trip) =>
    trip.status == IntercityTripStatus.open ||
    trip.status == IntercityTripStatus.full ||
    trip.status == IntercityTripStatus.boarding;

/// "Qatnovlarim" bo'linmasi.
class IntercityDriverTrips {
  const IntercityDriverTrips({required this.upcoming, required this.past});

  /// Faol qatnovlar jo'nash bo'yicha; tugagan/bekor qilinganlar — yangisi
  /// birinchi. Yo'ldagi qatnov jo'nash vaqti o'tgan bo'lsa ham "kelgusi"
  /// ro'yxatining BOSHIDA turadi: haydovchi uni hozir boshqarmoqda.
  factory IntercityDriverTrips.split(List<IntercityTrip> trips) {
    final upcoming = trips.where(isLiveTrip).toList()
      ..sort((a, b) => a.departureAt.compareTo(b.departureAt));
    final past = trips.where((t) => !isLiveTrip(t)).toList()
      ..sort((a, b) => b.departureAt.compareTo(a.departureAt));
    return IntercityDriverTrips(
      upcoming: List.unmodifiable(upcoming),
      past: List.unmodifiable(past),
    );
  }

  final List<IntercityTrip> upcoming;
  final List<IntercityTrip> past;

  IntercityTrip? get next => upcoming.isEmpty ? null : upcoming.first;
}

// ---------------------------------------------------------------- qatnovni boshqarish

/// Yig'ish tartibi: tirik bandlar oldin — haydovchidan eng yaqin olish
/// nuqtasidan boshlab; koordinatasizlar tiriklar oxirida; yakunlangan va
/// bekor qilinganlar eng pastda (haydovchi ularni ko'rsin, lekin ular
/// yo'lda xalaqit bermasin). Joylashuv noma'lum bo'lsa — server tartibi.
///
/// Kirish ro'yxati o'zgarmaydi — yangi ro'yxat qaytadi.
List<IntercityDriverBooking> orderBookingsNearestFirst(
  List<IntercityDriverBooking> bookings, {
  double? fromLat,
  double? fromLng,
}) {
  final live = bookings.where((b) => b.isLive).toList();
  final finished = bookings.where((b) => !b.isLive).toList();
  if (fromLat != null && fromLng != null) {
    double distance(IntercityDriverBooking b) => b.hasPickupPoint
        ? haversineKm(fromLat, fromLng, b.pickupLat!, b.pickupLng!)
        : double.infinity;
    // `sort` barqaror emas — teng masofada asl tartibni indeks saqlaydi.
    final indexed = live.asMap().entries.toList()
      ..sort((a, b) {
        final byDistance = distance(a.value).compareTo(distance(b.value));
        return byDistance != 0 ? byDistance : a.key.compareTo(b.key);
      });
    return List.unmodifiable([...indexed.map((e) => e.value), ...finished]);
  }
  return List.unmodifiable([...live, ...finished]);
}

/// "Yo'lga chiqish": server `departBlocker` bilan bir xil — qatnov
/// `boarding`, kamida bitta tirik band va har bir tirik yo'lovchi olingan.
bool canDepart(String tripStatus, List<IntercityDriverBooking> bookings) {
  if (tripStatus != IntercityTripStatus.boarding) return false;
  final live = bookings.where((b) => b.isLive).toList();
  if (live.isEmpty) return false;
  return live.every((b) => b.status == 'arrived' || b.status == 'in_progress');
}

/// Yo'lovchilardan olingan naqd — faqat yakunlangan bandlar.
double intercityCashTotal(List<IntercityDriverBooking> bookings) => bookings
    .where((b) => b.status == 'completed')
    .fold(0, (sum, b) => sum + b.price);
