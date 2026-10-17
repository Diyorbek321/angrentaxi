import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';

/// Server kodlari (backend/src/common/errors/coded-error.ts).
abstract final class IntercityErrorCode {
  static const disabled = 'INTERCITY_DISABLED';
  static const seatsUnavailable = 'INTERCITY_SEATS_UNAVAILABLE';
  static const alreadyBooked = 'INTERCITY_ALREADY_BOOKED';
  static const bookingInvalid = 'INTERCITY_BOOKING_INVALID';
  static const bookingNotCancellable = 'INTERCITY_BOOKING_NOT_CANCELLABLE';
  // Tumanlar va aylanma (backend 039).
  static const outOfZone = 'INTERCITY_OUT_OF_ZONE';
  static const detourTooLong = 'INTERCITY_DETOUR_TOO_LONG';
  // Haydovchi.
  static const serviceNotEnabled = 'INTERCITY_SERVICE_NOT_ENABLED';
  static const tripInvalid = 'INTERCITY_TRIP_INVALID';
  static const tripOverlap = 'INTERCITY_TRIP_OVERLAP';
  static const tripNotCancellable = 'INTERCITY_TRIP_NOT_CANCELLABLE';
  static const tripActionNotAllowed = 'INTERCITY_TRIP_ACTION_NOT_ALLOWED';
  static const driverBusy = 'DRIVER_BUSY';
}

/// Foydalanuvchiga ko'rsatiladigan matn.
///
/// Ma'lum kodlar ilova tilida; `INTERCITY_BOOKING_INVALID` da server
/// `reasons[]` matnlari (allaqachon foydalanuvchi tilida — server xato
/// katalogi `Accept-Language` bo'yicha tarjima qiladi) qatorlab beriladi.
String intercityErrorMessage(Object? error) {
  final l10n = AppL10n.current;
  final api = ApiError.from(error);
  switch (api?.code) {
    case IntercityErrorCode.disabled:
      return l10n.icErrDisabled;
    case IntercityErrorCode.seatsUnavailable:
      return l10n.icErrSeatsUnavailable;
    case IntercityErrorCode.alreadyBooked:
      return l10n.icErrAlreadyBooked;
    case IntercityErrorCode.bookingNotCancellable:
      return l10n.icErrNotCancellable;
    case IntercityErrorCode.outOfZone:
      final zones = '${api!.details['zones'] ?? ''}'.trim();
      return l10n.icErrOutOfZone(zones.isEmpty ? '—' : zones);
    case IntercityErrorCode.detourTooLong:
      final minutes = api!.details['addedMinutes'];
      return l10n.icErrDetourTooLong(minutes is num ? minutes.toInt() : 0);
    case IntercityErrorCode.serviceNotEnabled:
      return l10n.icErrServiceNotEnabled;
    case IntercityErrorCode.tripOverlap:
      return l10n.icErrTripOverlap;
    case IntercityErrorCode.tripNotCancellable:
      return l10n.icErrTripNotCancellable;
    case IntercityErrorCode.tripActionNotAllowed:
      return l10n.icErrTripActionNotAllowed;
    case IntercityErrorCode.driverBusy:
      return l10n.icErrDriverBusy;
    case IntercityErrorCode.bookingInvalid:
    case IntercityErrorCode.tripInvalid:
      final reasons = api!.reasons.map((r) => r.message).join('\n');
      return reasons.isNotEmpty ? reasons : (api.message ?? l10n.icErrGeneric);
  }
  return api?.message ?? l10n.icErrGeneric;
}

bool isSeatsUnavailable(Object? error) =>
    ApiError.from(error)?.code == IntercityErrorCode.seatsUnavailable;

/// Qatnov yo'lovchi manziliga mos emas (tuman/aylanma) — boshqasini tanlash kerak.
bool isTripMismatch(Object? error) {
  final code = ApiError.from(error)?.code;
  return code == IntercityErrorCode.outOfZone || code == IntercityErrorCode.detourTooLong;
}

/// Tumanlar ro'yxati: "Yunusobod, Chilonzor".
String intercityDistrictNames(Iterable<IntercityDistrict> districts) =>
    districts.map((d) => d.name).join(', ');

String intercityBookingStatusLabel(String status) {
  final l10n = AppL10n.current;
  return switch (status) {
    'accepted' => l10n.icStatusAccepted,
    'arrived' => l10n.icStatusArrived,
    'in_progress' => l10n.icStatusInProgress,
    'completed' => l10n.icStatusCompleted,
    'cancelled' => l10n.icStatusCancelled,
    _ => l10n.icStatusScheduled,
  };
}

String intercityClassLabel(String tripClass) =>
    tripClass == IntercityTripClass.comfort
        ? AppL10n.current.icClassComfort
        : AppL10n.current.icClassStart;

String _two(int v) => v.toString().padLeft(2, '0');

/// "07:30" — Toshkent vaqti.
String formatTashkentTime(DateTime instant) {
  final t = toTashkent(instant);
  return '${_two(t.hour)}:${_two(t.minute)}';
}

/// "18.10 · 07:30" — Toshkent vaqti.
String formatTashkentDayTime(DateTime instant) {
  final t = toTashkent(instant);
  return '${_two(t.day)}.${_two(t.month)} · ${_two(t.hour)}:${_two(t.minute)}';
}

/// "2 soat 15 daq" / "40 daq". Manfiy qiymat — 0.
String formatIntercityDuration(Duration d) {
  final l10n = AppL10n.current;
  final minutes = d.isNegative ? 0 : d.inMinutes;
  final hours = minutes ~/ 60;
  return hours > 0
      ? l10n.icDurationHm(hours, minutes % 60)
      : l10n.icDurationM(minutes);
}

/// Sana chipi: "Bugun", "Ertaga", keyin "20.10".
String intercityDayChipLabel(String dateKey, int index) {
  final l10n = AppL10n.current;
  if (index == 0) return l10n.icToday;
  if (index == 1) return l10n.icTomorrow;
  final parts = dateKey.split('-');
  return parts.length == 3 ? '${parts[2]}.${parts[1]}' : dateKey;
}

/// Qatnov (haydovchi e'loni) holati.
String intercityTripStatusLabel(String status) {
  final l10n = AppL10n.current;
  return switch (status) {
    IntercityTripStatus.full => l10n.icTripFull,
    IntercityTripStatus.boarding => l10n.icTripBoarding,
    IntercityTripStatus.inProgress => l10n.icTripInProgress,
    IntercityTripStatus.completed => l10n.icTripCompleted,
    IntercityTripStatus.cancelled => l10n.icTripCancelledStatus,
    _ => l10n.icTripOpen,
  };
}

/// "Angren → Rohat krugi".
String intercityRouteLabel(String origin, String destination) =>
    '$origin → $destination';

/// Km: butun bo'lsa "30", aks holda bitta kasr bilan "12.4".
String formatIntercityKm(double km) =>
    km == km.roundToDouble() ? km.toInt().toString() : km.toStringAsFixed(1);

/// "Rohat krugi → manzil: 12.4 km × 2 000 so'm" (olishda teskari tartib).
String intercityExtensionLine(
    AppLocalizations l10n, IntercityExtensionCharge charge) {
  final km = charge.km.toStringAsFixed(1);
  final price = Formatters.formatPrice(charge.pricePerKm);
  return charge.isDropoff
      ? l10n.icExtensionDropoffLine(charge.pointName, km, price)
      : l10n.icExtensionPickupLine(charge.pointName, km, price);
}

