import 'dart:async';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/wallet/driver_push_events.dart';
import 'package:angren_taxi/features/driver/wallet/driver_wallet_provider.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_deep_links.dart';
import 'package:angren_taxi/features/driver/wallet/wallet_messages.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Haydovchi to'ldirish ekrani marshruti.
const String kDriverTopupRoute = '/driver/wallet/topup';

/// Butun ilova bo'ylab hamyon hodisalarini qabul qiladi:
///
///   · realtime `wallet:updated` → qoldiq allaqachon yangilangan
///     (DriverProvider), bu yerda faqat SABAB bilan snackbar;
///   · push `data.event` → qoldiqni qayta o'qish; kuryer eslatmasi bosilsa
///     to'ldirish ekrani ochiladi.
///
/// `MaterialApp.builder` ichida turadi (Navigator'dan YUQORIDA), shuning
/// uchun navigatsiya [navigatorKey] orqali.
class DriverWalletEventsHost extends StatefulWidget {
  const DriverWalletEventsHost({
    super.key,
    required this.navigatorKey,
    required this.child,
    this.pushStream,
    this.topupLinkStream,
  });

  final GlobalKey<NavigatorState> navigatorKey;
  final Widget child;

  /// Testlar uchun; standart — [DriverPushBus.instance].
  final Stream<DriverPushMessage>? pushStream;

  /// Testlar uchun; standart — [DriverDeepLinks.instance] (to'ldirish id'lari).
  final Stream<String>? topupLinkStream;

  @override
  State<DriverWalletEventsHost> createState() => _DriverWalletEventsHostState();
}

class _DriverWalletEventsHostState extends State<DriverWalletEventsHost> {
  StreamSubscription<WalletUpdate>? _walletSub;
  StreamSubscription<DriverPushMessage>? _pushSub;
  StreamSubscription<String>? _linkSub;

  /// Oxirgi `wallet:updated` vaqti — xuddi shu o'zgarish uchun push ham
  /// kelsa, ikkinchi snackbar chiqmasin.
  DateTime? _lastRealtimeUpdate;
  static const _dedupeWindow = Duration(seconds: 15);

  @override
  void initState() {
    super.initState();
    final driver = context.read<DriverProvider>();
    _walletSub = driver.walletUpdates.listen(_onWalletUpdate);
    _pushSub =
        (widget.pushStream ?? DriverPushBus.instance.stream).listen(_onPush);
    _linkSub = (widget.topupLinkStream ?? DriverDeepLinks.instance.topupLinks)
        .listen(_onTopupLink);
  }

  @override
  void dispose() {
    _walletSub?.cancel();
    _pushSub?.cancel();
    _linkSub?.cancel();
    super.dispose();
  }

  DriverWalletProvider? get _wallet {
    try {
      return context.read<DriverWalletProvider>();
    } catch (_) {
      return null;
    }
  }

  void _onWalletUpdate(WalletUpdate update) {
    _lastRealtimeUpdate = DateTime.now();
    final wallet = _wallet;
    if (update.reason == 'topup' && update.topupId != null) {
      wallet?.markTopupPaid(update.topupId!);
    }
    if (update.reason == 'shift_pass_refund') wallet?.loadShiftPass();
    _showSnack(walletUpdateText(update));
  }

  void _onPush(DriverPushMessage message) {
    final driver = context.read<DriverProvider>();
    switch (message.action) {
      case DriverPushAction.refreshWallet:
        driver.loadWalletBalance();
        _wallet?.loadTopups();
        if (message.event == DriverPushEvent.shiftPassCancelled) {
          _wallet?.loadShiftPass();
        }
        final recent = _lastRealtimeUpdate != null &&
            DateTime.now().difference(_lastRealtimeUpdate!) < _dedupeWindow;
        final body = refundClawbackAwareBody(message);
        if (!message.opened && !recent && body != null && body.isNotEmpty) {
          _showSnack(body);
        }
        if (message.opened) _openTopupOrEarnings(earnings: true);
      case DriverPushAction.openTopup:
        if (message.opened) {
          _openTopupOrEarnings(earnings: false);
        } else {
          _showSnack(
            message.body ?? AppL10n.current.wltReminderFallback,
            actionLabel: AppL10n.current.wltTopUpShort,
            onAction: () => _openTopupOrEarnings(earnings: false),
          );
        }
      case DriverPushAction.none:
        break;
    }
  }

  /// To'lov sahifasidan qaytish (`angrengo://wallet/topup/<id>`): shu
  /// to'ldirish holati ekrani. To'ldirish ekrani allaqachon tepada bo'lsa —
  /// almashtiriladi (ikkita bir xil ekran to'planmasin). Qoldiq ham qayta
  /// o'qiladi.
  void _onTopupLink(String topupId) {
    final navigator = widget.navigatorKey.currentState;
    if (navigator == null) return;
    context.read<DriverProvider>().loadWalletBalance();
    String? topName;
    navigator.popUntil((route) {
      topName = route.settings.name;
      return true;
    });
    if (topName == kDriverTopupRoute) {
      navigator.pushReplacementNamed(kDriverTopupRoute, arguments: topupId);
    } else {
      navigator.pushNamed(kDriverTopupRoute, arguments: topupId);
    }
  }

  void _openTopupOrEarnings({required bool earnings}) {
    final navigator = widget.navigatorKey.currentState;
    if (navigator == null) return;
    navigator.pushNamed(earnings ? '/driver/earnings' : kDriverTopupRoute);
  }

  void _showSnack(
    String text, {
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    final messenger = ScaffoldMessenger.maybeOf(context);
    if (messenger == null) return;
    messenger.showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: kInk,
        duration: const Duration(seconds: 6),
        action: actionLabel == null || onAction == null
            ? null
            : SnackBarAction(
                label: actionLabel,
                textColor: kMintSoft,
                onPressed: onAction,
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
