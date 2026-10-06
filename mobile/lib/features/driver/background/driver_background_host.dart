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
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _bridge.onLifecycle(state);
  }

  @override
  void dispose() {
    _driver.removeListener(_bridge.onDriverChanged);
    WidgetsBinding.instance.removeObserver(this);
    widget.overlay.hideBubble();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.child;
}
