import 'dart:async';

import 'package:angren_taxi/core/platform/driver_overlay.dart';
import 'package:angren_taxi/features/driver/background/driver_background_bridge.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

/// Haydovchi ilovasining butun hayoti davomida [DriverBackgroundBridge] ni
/// ilova holati va [DriverProvider] ga ulaydi.
///
/// `MaterialApp.builder` ichida turadi — ekranlar almashganda (bosh ekran →
/// safar) qayta qurilmaydi, ya'ni holat (qaysi zakaz e'lon qilingan) yo'qolmaydi.
class DriverBackgroundHost extends StatefulWidget {
  const DriverBackgroundHost({super.key, required this.child, this.overlay = const DriverOverlay()});

  final Widget child;
  final DriverOverlay overlay;

  @override
  State<DriverBackgroundHost> createState() => _DriverBackgroundHostState();
}

class _DriverBackgroundHostState extends State<DriverBackgroundHost> with WidgetsBindingObserver {
  late final DriverProvider _driver = context.read<DriverProvider>();
  late final DriverBackgroundBridge _bridge = DriverBackgroundBridge(
    overlay: widget.overlay,
    isOnline: () => _driver.isOnline,
    pendingOffer: () => _driver.pendingOffer,
    offerTimeLeft: () => _driver.offerTimeLeft,
    noticeFor: (offer) {
      final l10n = AppL10n.current;
      final price = offer.isMetered
          ? l10n.shMeterAtLeast(Formatters.formatPrice(offer.estimatedPrice))
          : Formatters.formatPrice(offer.estimatedPrice);
      return (
        title: l10n.drvOfferNotificationTitle,
        text: '${offer.pickup.address} · $price',
        channel: l10n.drvOfferNotificationChannel,
      );
    },
  );

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _driver.addListener(_bridge.onDriverChanged);
    // Sovuq start jiringlagan taklif bildirishnomasidan: ilova qulf USTIDA
    // ochilgan, lekin taklif allaqachon tugagan bo'lishi mumkin. Tiklash
    // so'roviga vaqt beriladi; taklif topilmasa qulf ustidan chiqiladi —
    // aks holda hamyon va profil qulfni ochmasdan ochiq qolardi.
    _coldStartLockCheck = Timer(coldStartLockCheckDelay, _releaseLockIfNoOffer);
  }

  /// Sovuq startda qulf tekshiruvi kechikishi (testlarda qisqartiriladi).
  @visibleForTesting
  static Duration coldStartLockCheckDelay = const Duration(seconds: 8);

  Timer? _coldStartLockCheck;

  /// Taklif yo'q — qulf ustida ko'rsatish to'xtaydi. Native tomon buni faqat
  /// ilova taklif uchun qulf ustiga chiqqan bo'lsa bajaradi (aks holda jim).
  void _releaseLockIfNoOffer() {
    if (!mounted || _driver.pendingOffer != null) return;
    widget.overlay.releaseLockScreen();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _bridge.onLifecycle(state);
    // Fonda socket uxlab qolgan bo'lishi mumkin — o'tkazib yuborilgan taklif
    // serverdan tiklanadi.
    if (state == AppLifecycleState.resumed) {
      // Faol safar oflayn rejimda ham davom etadi — holat har doim tiklanadi.
      _driver.resyncActiveTrip();
      if (_driver.isOnline) {
        _driver.resyncPendingOffer().whenComplete(_releaseLockIfNoOffer);
      } else {
        _releaseLockIfNoOffer();
      }
    }
  }

  @override
  void dispose() {
    _coldStartLockCheck?.cancel();
    _driver.removeListener(_bridge.onDriverChanged);
    WidgetsBinding.instance.removeObserver(this);
    widget.overlay.hideBubble();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
