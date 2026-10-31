import 'dart:async';

import 'package:flutter/foundation.dart';

// ============================================================================
// PUSH BOSILDI → QAYSI EKRAN.
//
// Uch manba bitta joyga yig'iladi (`PushNotifications`):
//   · fonda kelgan push (FCM `onMessageOpenedApp`);
//   · ilova yopiq turganda bosilgan push (`getInitialMessage`);
//   · ilova ochiq turganda ilovaning o'zi chiqargan bildirishnoma
//     (Android `EXTRA_PUSH_DATA` → `tapped` / `takeLaunchTap`).
//
// Ekran faqat bosh ekran [PushTapRouter.markReady] chaqirgach ochiladi —
// aks holda sovuq startdagi kirish/onboarding `pushReplacement` i ochilgan
// ekranni yo'qotardi (DriverDeepLinks bilan bir xil naqsh).
//
// Taksi buyurtmasi pushlari (`order_*`, `driver_arrived`, ...) ATAYLAB
// yo'naltirilmaydi: bosh ekranning o'zi faol buyurtmani ko'rsatadi.
// Hamyon pushlari esa `DriverWalletEventsHost` da.
// ============================================================================

/// Server `data.event` qiymatlari (backend notifications / intercity-notifier).
abstract final class PushEvent {
  static const intercityRequestCreated = 'intercity_request_created';
  static const intercityRequestAccepted = 'intercity_request_accepted';
  static const intercityRequestExpired = 'intercity_request_expired';
  static const intercityBookingCreated = 'intercity_booking_created';
  static const intercityBookingCancelled = 'intercity_booking_cancelled';
  static const intercityBookingCancelledByDispatcher = 'intercity_booking_cancelled_by_dispatcher';
  static const intercityBoardingStarted = 'intercity_boarding_started';
  static const intercityDepartureReminder = 'intercity_departure_reminder';
  static const intercityTripCancelled = 'intercity_trip_cancelled';
  static const supportReply = 'support_reply';
  static const lostItemReported = 'lost_item_reported';
  static const lostItemAnswered = 'lost_item_answered';
  static const verificationDue = 'verification_due';
  static const bonusAwarded = 'bonus_awarded';
}

enum PushTapTarget {
  /// Haydovchi: yo'lovchi so'rovlari doskasi.
  intercityRequestBoard,

  /// Haydovchi: shaharlararo qatnovlarim.
  intercityDriverTrips,

  /// Yo'lovchi: shaharlararo bandlarim.
  intercityBookings,

  /// Yo'lovchi: mening so'rovlarim.
  intercityRequests,
  supportChat,
  lostItems,
  driverVerification,
  driverEarnings,
}

/// Push turi va ilova (haydovchi/yo'lovchi) bo'yicha ochiladigan ekran;
/// `null` — hech narsa ochilmaydi (ilova shunchaki ochiladi).
///
/// Bir xil hodisa ikki rolga ham kelishi mumkin (masalan jo'nash eslatmasi
/// haydovchiga ham, yo'lovchilarga ham) — shuning uchun [driver] hal qiladi.
PushTapTarget? pushTapTarget(Map<String, dynamic> data, {required bool driver}) {
  final event = data['event']?.toString();
  if (driver) {
    return switch (event) {
      PushEvent.intercityRequestCreated => PushTapTarget.intercityRequestBoard,
      PushEvent.intercityBookingCreated ||
      PushEvent.intercityBookingCancelled ||
      PushEvent.intercityDepartureReminder =>
        PushTapTarget.intercityDriverTrips,
      PushEvent.supportReply => PushTapTarget.supportChat,
      PushEvent.lostItemReported => PushTapTarget.lostItems,
      PushEvent.verificationDue => PushTapTarget.driverVerification,
      PushEvent.bonusAwarded => PushTapTarget.driverEarnings,
      _ => null,
    };
  }
  return switch (event) {
    PushEvent.intercityRequestAccepted ||
    PushEvent.intercityBookingCancelledByDispatcher ||
    PushEvent.intercityBoardingStarted ||
    PushEvent.intercityDepartureReminder ||
    PushEvent.intercityTripCancelled =>
      PushTapTarget.intercityBookings,
    PushEvent.intercityRequestExpired => PushTapTarget.intercityRequests,
    PushEvent.supportReply => PushTapTarget.supportChat,
    PushEvent.lostItemAnswered => PushTapTarget.lostItems,
    _ => null,
  };
}

/// Ilova bo'ylab yagona qabul qiluvchi. Bosh ekran tayyor bo'lguncha OXIRGI
/// bosilgan push saqlanadi (bir nechtasi bosilgan bo'lsa — eng so'nggisi).
class PushTapRouter {
  PushTapRouter({required this.driver});

  /// `main_*.dart` da rolga qarab o'rnatiladi.
  static PushTapRouter instance = PushTapRouter(driver: false);

  final bool driver;
  final StreamController<PushTapTarget> _controller = StreamController<PushTapTarget>.broadcast();
  PushTapTarget? _pending;
  bool _ready = false;

  Stream<PushTapTarget> get targets => _controller.stream;

  /// Bosilgan push ma'lumoti. Ekrani bo'lmagan hodisa — e'tiborsiz.
  void handle(Map<String, dynamic> data) {
    final target = pushTapTarget(data, driver: driver);
    if (target == null) return;
    if (!_ready || !_controller.hasListener) {
      _pending = target;
    } else {
      _controller.add(target);
    }
  }

  /// Bosh ekran (kirgan foydalanuvchi) chizildi.
  void markReady() {
    _ready = true;
    final pending = _pending;
    _pending = null;
    if (pending != null) _controller.add(pending);
  }

  /// Chiqishda: keyingi bosish kirishdan keyingi bosh ekranni kutsin.
  void markNotReady() => _ready = false;

  @visibleForTesting
  PushTapTarget? get pendingForTest => _pending;
}
