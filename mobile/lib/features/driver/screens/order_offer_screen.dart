import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';

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
          backgroundColor: kSecondaryBlack,
          body: SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: Container(
                    width: double.infinity,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(28),
                      ),
                    ),
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildCountdownTimer(),
                          const SizedBox(height: 24),
                          _buildPriceCard(offer),
                          const SizedBox(height: 20),
                          _buildRouteInfo(offer),
                          const SizedBox(height: 20),
                          if (_distanceToPickup != null) _buildDistanceInfo(),
                          const SizedBox(height: 32),
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
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: kPrimaryYellow,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.local_taxi, color: Colors.white, size: 28),
          ),
          const SizedBox(height: 8),
          const Text(
            'Yangi buyurtma!',
            style: TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
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
                  backgroundColor: Colors.grey.shade200,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    _secondsLeft > 5 ? kPrimaryYellow : kError,
                  ),
                ),
              ),
            ),
            Text(
              '$_secondsLeft',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                color: _secondsLeft > 5 ? kTextPrimary : kError,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          'Qabul qilish uchun $_secondsLeft soniya qoldi',
          style: const TextStyle(color: kTextSecondary, fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildPriceCard(Order offer) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [kPrimary, kPrimaryDark],
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          const Text(
            'Taxminiy daromad',
            style: TextStyle(fontSize: 13, color: Colors.white70),
          ),
          const SizedBox(height: 4),
          Text(
            Formatters.formatPrice(offer.estimatedPrice),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRouteInfo(Order offer) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          _buildRouteRow(
            Icons.radio_button_checked,
            Colors.green,
            'Olish joyi',
            offer.pickup.address,
          ),
          const Padding(
            padding: EdgeInsets.only(left: 9),
            child: SizedBox(
              height: 16,
              child: VerticalDivider(width: 1, color: Colors.grey),
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
        Icon(icon, color: color, size: 20),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: kTextSecondary,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                address,
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w500),
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
        const Icon(Icons.directions_car, color: kPrimaryYellow, size: 18),
        const SizedBox(width: 8),
        Text(
          'Olish joyigacha: ${Formatters.formatDistance(_distanceToPickup!)}',
          style: const TextStyle(color: kTextSecondary, fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildActionButtons(Order offer, DriverProvider provider) {
    final isLoading = provider.state == DriverProviderState.loading;

    return Row(
      children: [
        Expanded(
          child: SizedBox(
            height: 56,
            child: OutlinedButton(
              onPressed: isLoading ? null : () => _onDecline(offer),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: kError, width: 2),
                foregroundColor: kError,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: const Text(
                'Rad etish',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          flex: 2,
          child: SizedBox(
            height: 56,
            child: ElevatedButton(
              onPressed: isLoading ? null : () => _onAccept(offer),
              style: ElevatedButton.styleFrom(
                backgroundColor: kSuccess,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Qabul qilish',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
        ),
      ],
    );
  }
}
