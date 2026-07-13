import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen>
    with SingleTickerProviderStateMixin {
  final MapController _mapController = MapController();
  LatLng _currentLocation = LatLng(
    AppConfig.defaultLat,
    AppConfig.defaultLng,
  );
  bool _locationLoading = true;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _initLocation();
    _initPulseAnimation();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      final driver = context.read<DriverProvider>();
      driver.initialize();
      driver.addListener(_onDriverProviderChanged);
    });
  }

  void _initPulseAnimation() {
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.8, end: 1.2).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
  }

  void _onDriverProviderChanged() {
    final driver = context.read<DriverProvider>();
    if (driver.pendingOffer != null && mounted) {
      Navigator.of(context).pushNamed('/driver/offer');
    }
    // Surfaces goOnline/goOffline failures — critically the "balance is
    // negative" block, which the driver otherwise has no way to see.
    if (driver.state == DriverProviderState.error &&
        driver.error != null &&
        mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(driver.error!), backgroundColor: Colors.red),
      );
      driver.clearError();
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    try {
      context.read<DriverProvider>().removeListener(_onDriverProviderChanged);
    } catch (_) {}
    super.dispose();
  }

  Future<void> _initLocation() async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (position != null && mounted) {
      setState(() {
        _currentLocation = LatLng(position.latitude, position.longitude);
        _locationLoading = false;
      });
      _mapController.move(_currentLocation, 15);
    } else {
      if (mounted) setState(() => _locationLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<DriverProvider>(
        builder: (context, driverProvider, _) {
          return Stack(
            children: [
              _buildMap(driverProvider),
              if (_locationLoading) const LoadingWidget(),
              _buildTopBar(driverProvider),
              _buildBottomPanel(driverProvider),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMap(DriverProvider driverProvider) {
    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: _currentLocation,
        initialZoom: 15,
        minZoom: 5,
        maxZoom: 19,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'uz.angren.taxi',
        ),
        MarkerLayer(
          markers: [
            Marker(
              point: _currentLocation,
              width: 48,
              height: 48,
              child: Container(
                decoration: BoxDecoration(
                  color: driverProvider.isOnline
                      ? kPrimaryYellow
                      : Colors.grey.shade400,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: const [
                    BoxShadow(color: Colors.black26, blurRadius: 6),
                  ],
                ),
                child: const Icon(
                  Icons.local_taxi,
                  color: Colors.black,
                  size: 24,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTopBar(DriverProvider driverProvider) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(color: Colors.black12, blurRadius: 6),
                ],
              ),
              child: Consumer<AuthProvider>(
                builder: (context, auth, _) => IconButton(
                  icon: const Icon(Icons.menu),
                  onPressed: () => _showMenu(context, auth, driverProvider),
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: driverProvider.isOnline ? kSuccess : Colors.grey.shade600,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    driverProvider.isOnline ? 'Online' : 'Offline',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(color: Colors.black12, blurRadius: 6),
                ],
              ),
              child: IconButton(
                icon: const Icon(Icons.my_location),
                onPressed: _initLocation,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomPanel(DriverProvider driverProvider) {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 36),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          boxShadow: [
            BoxShadow(color: Colors.black12, blurRadius: 16),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            if (driverProvider.hasActiveOrder)
              _buildActiveOrderCard(driverProvider)
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .slideY(begin: 0.3, curve: Curves.easeOutCubic)
            else
              _buildOnlineToggle(driverProvider)
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .slideY(begin: 0.3, curve: Curves.easeOutCubic),
          ],
        ),
      ),
    );
  }

  Widget _buildOnlineToggle(DriverProvider driverProvider) {
    final isOnline = driverProvider.isOnline;
    final isLoading = driverProvider.state == DriverProviderState.loading;

    return Column(
      children: [
        if (isOnline)
          _buildWaitingForOrders()
        else
          Column(
            children: [
              Text(
                'Ishlashni boshlash',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'Online holatga o\'ting va buyurtmalar qabul qiling',
                style: TextStyle(color: kTextSecondary, fontSize: 13),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        const SizedBox(height: 20),
        _buildEarningsRow(driverProvider),
        const SizedBox(height: 20),
        GestureDetector(
          onTap: isLoading
              ? null
              : (isOnline ? driverProvider.goOffline : driverProvider.goOnline),
          child: Container(
            width: double.infinity,
            height: 58,
            decoration: BoxDecoration(
              gradient: isOnline
                  ? null
                  : const LinearGradient(colors: [kPrimary, kPrimaryDark]),
              color: isOnline ? kInk : null,
              borderRadius: BorderRadius.circular(kRadiusMd),
              boxShadow: isOnline
                  ? null
                  : [
                      BoxShadow(
                        color: kPrimary.withValues(alpha: 0.4),
                        blurRadius: 16,
                        offset: const Offset(0, 6),
                      ),
                    ],
            ),
            alignment: Alignment.center,
            child: isLoading
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : Text(
                    isOnline ? "Offline bo'lish" : "Online bo'lish",
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildWaitingForOrders() {
    return Column(
      children: [
        AnimatedBuilder(
          animation: _pulseAnimation,
          builder: (context, child) {
            return Transform.scale(
              scale: _pulseAnimation.value,
              child: child,
            );
          },
          child: Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: kPrimaryYellow.withAlpha(30),
              shape: BoxShape.circle,
              border: Border.all(color: kPrimaryYellow, width: 2),
            ),
            child: const Icon(Icons.wifi, color: kPrimaryYellow, size: 32),
          ),
        ),
        const SizedBox(height: 12),
        const Text(
          'Buyurtma kutilmoqda...',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Siz online holatdasiz',
          style: TextStyle(color: kSuccess, fontSize: 13),
        ),
      ],
    );
  }

  Widget _buildEarningsRow(DriverProvider driverProvider) {
    return Row(
      children: [
        Expanded(
          child: _EarningChip(
            icon: Icons.today,
            label: "Bugun",
            value: Formatters.formatPriceCompact(driverProvider.todayEarnings),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: GestureDetector(
            onTap: () => Navigator.of(context).pushNamed('/driver/earnings'),
            child: const _EarningChip(
              icon: Icons.history,
              label: 'Tarix',
              value: "Ko'rish",
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActiveOrderCard(DriverProvider driverProvider) {
    final order = driverProvider.activeOrder!;
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: kSurfaceGrey,
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Faol buyurtma',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 15,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: kPrimaryYellow.withAlpha(40),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      order.status.label,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: kSecondaryBlack,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              _buildOrderRouteRow(
                Icons.radio_button_checked,
                Colors.green,
                order.pickup.address,
              ),
              const SizedBox(height: 6),
              _buildOrderRouteRow(
                Icons.location_on,
                kError,
                order.dropoff.address,
              ),
              const Divider(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    Formatters.formatPrice(order.estimatedPrice),
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () => _navigateToActiveOrder(driverProvider),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kSecondaryBlack,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                    ),
                    child: const Text('Ko\'rish'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildOrderRouteRow(IconData icon, Color color, String text) {
    return Row(
      children: [
        Icon(icon, color: color, size: 16),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13),
          ),
        ),
      ],
    );
  }

  void _navigateToActiveOrder(DriverProvider provider) {
    final order = provider.activeOrder;
    if (order == null) return;

    switch (order.status) {
      case OrderStatus.driverAssigned:
      case OrderStatus.driverEnRoute:
        Navigator.of(context).pushNamed('/driver/navigation');
      case OrderStatus.driverArrived:
        Navigator.of(context).pushNamed('/driver/arrived');
      case OrderStatus.inProgress:
        Navigator.of(context).pushNamed('/driver/trip');
      default:
        break;
    }
  }

  void _showMenu(
    BuildContext context,
    AuthProvider auth,
    DriverProvider driverProvider,
  ) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: kSurfaceGrey,
                child: Icon(Icons.person, color: kTextPrimary),
              ),
              title: Text(auth.currentUser?.displayName ?? 'Haydovchi'),
              subtitle: Text(auth.currentUser?.phone ?? ''),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.account_balance_wallet_outlined),
              title: const Text('Daromad'),
              onTap: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pushNamed('/driver/earnings');
              },
            ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('Profil'),
              onTap: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pushNamed('/driver/profile');
              },
            ),
            ListTile(
              leading: const Icon(Icons.logout, color: kError),
              title: const Text('Chiqish', style: TextStyle(color: kError)),
              onTap: () {
                Navigator.of(ctx).pop();
                auth.logout();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}

class _EarningChip extends StatelessWidget {
  const _EarningChip({
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Icon(icon, color: kPrimaryYellow, size: 20),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: kTextSecondary,
                  fontSize: 11,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
