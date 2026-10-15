import 'dart:async';

import 'package:angren_taxi/l10n/l10n.dart';

/// Push bildirishnomaning `data.event` qiymatlari (docs/LEGAL-COMPLIANCE.md §17).
abstract final class DriverPushEvent {
  static const walletTopupPaid = 'wallet_topup_paid';
  static const walletTopupReversed = 'wallet_topup_reversed';
  static const walletManualAdjustment = 'wallet_manual_adjustment';
  static const shiftPassCancelled = 'shift_pass_cancelled';
  static const courierWalletSettlementReminder =
      'courier_wallet_settlement_reminder';

  /// Karta to'lovi mijozga qaytarildi — haydovchi/sotuvchi ulushi hamyondan
  /// qaytarib olindi (§23).
  static const paymentRefundClawback = 'payment_refund_clawback';

  /// Hamyon qoldig'ini o'zgartiradigan hodisalar — kelganda qoldiq qayta
  /// o'qiladi (push socket'dan oldin yetib kelishi yoki socket uzilgan
  /// bo'lishi mumkin).
  static const walletChanging = {
    walletTopupPaid,
    walletTopupReversed,
    walletManualAdjustment,
    shiftPassCancelled,
    paymentRefundClawback,
  };
}

/// Push bildirishnomaga javoban ilova nima qiladi.
enum DriverPushAction {
  /// Hech narsa (noma'lum hodisa).
  none,

  /// Qoldiqni (va smena/to'ldirishlarni) yangilash.
  refreshWallet,

  /// To'ldirish ekranini ochish (kuryer eslatmasi).
  openTopup,
}

DriverPushAction driverPushAction(String? event) {
  if (event == DriverPushEvent.courierWalletSettlementReminder) {
    return DriverPushAction.openTopup;
  }
  if (DriverPushEvent.walletChanging.contains(event)) {
    return DriverPushAction.refreshWallet;
  }
  return DriverPushAction.none;
}

class DriverPushMessage {
  const DriverPushMessage({
    required this.data,
    this.title,
    this.body,
    this.opened = false,
  });

  final Map<String, dynamic> data;
  final String? title;
  final String? body;

  /// Haydovchi bildirishnomani BOSIB ilovani ochdi (aks holda ilova ochiq
  /// turganda keldi).
  final bool opened;

  String? get event => data['event']?.toString();
  DriverPushAction get action => driverPushAction(event);
}

/// Firebase'dan mustaqil shina: `main_driver.dart` FCM xabarlarini shu yerga
/// yozadi, ilova ichidagi xost esa tinglaydi. Shu tufayli vidjet testlari
/// Firebase'siz ishlaydi.
class DriverPushBus {
  DriverPushBus._();

  static final DriverPushBus instance = DriverPushBus._();

  final StreamController<DriverPushMessage> _controller =
      StreamController<DriverPushMessage>.broadcast();

  /// Ilova yopiq turganda bosilgan bildirishnoma. Haydovchi bosh ekrani
  /// hali qurilmagan (kirish, onboarding darvozasi), u yerda ochilgan ekran
  /// keyingi `pushReplacementNamed` bilan yo'qolardi — shuning uchun bosh
  /// ekran [markReady] chaqirguncha saqlab turiladi.
  DriverPushMessage? _pendingOpened;
  bool _ready = false;

  Stream<DriverPushMessage> get stream => _controller.stream;

  void add(DriverPushMessage message) {
    if (message.opened && (!_ready || !_controller.hasListener)) {
      _pendingOpened = message;
      return;
    }
    _controller.add(message);
  }

  /// Bosh ekran tayyor: saqlangan bildirishnoma (bo'lsa) endi uzatiladi.
  void markReady() {
    _ready = true;
    final pending = _pendingOpened;
    _pendingOpened = null;
    if (pending != null) _controller.add(pending);
  }
}

/// Snackbar matni: bildirishnoma matni; to'lov qaytarimida matn bo'lmasa —
/// sababni tushuntiruvchi zaxira (haydovchi qoldiq nega kamayganini bilsin).
String? refundClawbackAwareBody(DriverPushMessage message) {
  final body = message.body?.trim();
  if (body != null && body.isNotEmpty) return body;
  if (message.event == DriverPushEvent.paymentRefundClawback) {
    return AppL10n.current.wltRefundClawbackFallback;
  }
  return body;
}
