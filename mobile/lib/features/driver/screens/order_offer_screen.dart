import 'dart:async';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class OrderOfferScreen extends StatefulWidget {
  const OrderOfferScreen({super.key});

  @override
  State<OrderOfferScreen> createState() => _OrderOfferScreenState();
}

class _OrderOfferScreenState extends State<OrderOfferScreen>
    with SingleTickerProviderStateMixin {
  Timer? _timer;
  int _secondsLeft = 0;
  late AnimationController _progressController;
  double? _distanceToPickup;

  @override
  void initState() {
    super.initState();
    _secondsLeft = AppConfig.orderOfferTimeout.inSeconds;

    _progressController = AnimationController(
      vsync: this,
      duration: AppConfig.orderOfferTimeout,
    )..forward();

    _startCountdown();
    _calculateDistance();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _progressController.dispose();
    super.dispose();
  }

  void _startCountdown() {
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_secondsLeft <= 0) {
        timer.cancel();
        if (mounted) _autoDecline();
        return;
      }
      if (mounted) setState(() => _secondsLeft--);
    });
  }

  Future<void> _calculateDistance() async {
    final provider = context.read<DriverProvider>();
    final offer = provider.pendingOffer;
    if (offer == null) return;

    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (position != null && mounted) {
      final dist = locationService.calculateDistance(
        position.latitude,
        position.longitude,
        offer.pickup.lat,
        offer.pickup.lng,
      );
      setState(() => _distanceToPickup = dist);
    }
  }

  void _autoDecline() {
    final provider = context.read<DriverProvider>();
    final offer = provider.pendingOffer;
    if (offer != null) {
      provider.declineOrder(offer.id);
    }
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _onAccept(Order offer) async {
    _timer?.cancel();
    final provider = context.read<DriverProvider>();
    await provider.acceptOrder(offer.id);

    if (!mounted) return;
    if (provider.state == DriverProviderState.success) {
      Navigator.of(context).pushReplacementNamed('/driver/navigation');
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
            content:
                Text(provider.error ?? 'Buyurtmani qabul qilib bo\'lmadi')),
      );
    }
  }

  Future<void> _onDecline(Order offer) async {
    _timer?.cancel();
    final provider = context.read<DriverProvider>();
    await provider.declineOrder(offer.id);
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DriverProvider>(
      builder: (context, provider, _) {
        final offer = provider.pendingOffer;
        if (offer == null) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) Navigator.of(context).pop();
          });
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        return Scaffold(
          backgroundColor: kInk,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(kRadiusXl),
                      ),
                    ),
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(kSpace4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildCountdownTimer(),
                          const SizedBox(height: kSpace6),
                          _buildPriceCard(offer),
                          const SizedBox(height: kSpace5),
                          _buildRouteInfo(offer),
                          const SizedBox(height: kSpace5),
                          if (_distanceToPickup != null) _buildDistanceInfo(),
                          const SizedBox(height: kSpace8),
                          _buildActionButtons(offer, provider),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    return const Padding(
      padding: EdgeInsets.all(kSpace5),
      child: Column(
        children: [
          // Mint TO'LDIRISH — ustida faqat ink ikona (7.84:1), oq emas.
          ExcludeSemantics(
            child: SizedBox(
              width: 56,
              height: 56,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: kMint,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.local_taxi, color: kOnMint, size: 28),
              ),
            ),
          ),
          SizedBox(height: kSpace2),
          Text(
            'Yangi buyurtma!',
            style: TextStyle(
              color: kOnPrimary,
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCountdownTimer() {
    return Column(
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            AnimatedBuilder(
              animation: _progressController,
              builder: (context, _) => SizedBox(
                width: 80,
                height: 80,
                child: CircularProgressIndicator(
                  value: 1 - _progressController.value,
                  strokeWidth: 5,
                  backgroundColor: kSurface2,
                  // Progress = interaktiv qatlam → kPrimary.
                  valueColor: AlwaysStoppedAnimation<Color>(
                    _secondsLeft > 5 ? kPrimary : kError,
                  ),
                ),
              ),
            ),
            Text(
              '$_secondsLeft',
              style: TextStyle(
                fontSize: kFontDisplay,
                fontWeight: FontWeight.w800,
                color: _secondsLeft > 5 ? kInk : kErrorDeep,
              ),
            ),
          ],
        ),
        const SizedBox(height: kSpace2),
        Text(
          'Qabul qilish uchun $_secondsLeft soniya qoldi',
          style: const TextStyle(color: kInkMuted, fontSize: kFontLabel),
        ),
      ],
    );
  }

  Widget _buildPriceCard(Order offer) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        // To'q yashil CTA gradienti — oq matn butun diapazonda AA.
        gradient: kGradientCta,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        children: [
          Text(
            'Taxminiy daromad',
            style: TextStyle(
              fontSize: kFontLabel,
              color: kOnPrimary.withValues(alpha: 0.85),
            ),
          ),
          const SizedBox(height: kSpace1),
          Text(
            Formatters.formatPrice(offer.estimatedPrice),
            style: const TextStyle(
              fontSize: kFontDisplay,
              fontWeight: FontWeight.w800,
              color: kOnPrimary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRouteInfo(Order offer) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        children: [
          _buildRouteRow(
            Icons.radio_button_checked,
            kPrimary,
            'Olish joyi',
            offer.pickup.address,
          ),
          const Padding(
            padding: EdgeInsets.only(left: 9),
            child: SizedBox(
              height: kSpace4,
              child: VerticalDivider(width: 1, color: kLineStrong),
            ),
          ),
          _buildRouteRow(
            Icons.location_on,
            kError,
            'Manzil',
            offer.dropoff.address,
          ),
        ],
      ),
    );
  }

  Widget _buildRouteRow(
    IconData icon,
    Color color,
    String label,
    String address,
  ) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(child: Icon(icon, color: color, size: 20)),
        const SizedBox(width: kSpace3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: kInkMuted,
                  fontSize: kFontMicro,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                address,
                style: const TextStyle(
                  fontSize: kFontBody,
                  fontWeight: FontWeight.w600,
                  color: kInk,
                ),
                maxLines: 2,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildDistanceInfo() {
    return Row(
      children: [
        const ExcludeSemantics(
          child: Icon(Icons.directions_car, color: kPrimary, size: 18),
        ),
        const SizedBox(width: kSpace2),
        Text(
          'Olish joyigacha: ${Formatters.formatDistance(_distanceToPickup!)}',
          style: const TextStyle(color: kInkMuted, fontSize: kFontBody),
        ),
      ],
    );
  }

  Widget _buildActionButtons(Order offer, DriverProvider provider) {
    final isLoading = provider.state == DriverProviderState.loading;

    return Row(
      children: [
        Expanded(
          child: Semantics(
            button: true,
            enabled: !isLoading,
            label: 'Rad etish',
            excludeSemantics: true,
            child: SizedBox(
              height: kControlHeight,
              child: OutlinedButton(
                onPressed: isLoading ? null : () => _onDecline(offer),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: kError, width: 1.5),
                  // Xavf MATNI kErrorDeep (6.47:1), kError faqat chegara.
                  foregroundColor: kErrorDeep,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                  ),
                ),
                child: const Text(
                  'Rad etish',
                  style: TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: kSpace3),
        Expanded(
          flex: 2,
          child: Semantics(
            button: true,
            enabled: !isLoading,
            label: 'Qabul qilish',
            value: isLoading ? 'Yuklanmoqda' : null,
            excludeSemantics: true,
            child: SizedBox(
              height: kControlHeight,
              child: ElevatedButton(
                onPressed: isLoading ? null : () => _onAccept(offer),
                style: ElevatedButton.styleFrom(
                  // Oldin kSuccess (mint) + oq matn = 2.12:1 edi.
                  backgroundColor: kPrimary,
                  foregroundColor: kOnPrimary,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                  ),
                ),
                child: isLoading
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: kOnPrimary,
                        ),
                      )
                    : const Text(
                        'Qabul qilish',
                        style: TextStyle(
                          fontSize: kFontTitle,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
