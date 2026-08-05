import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key});

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen>
    with SingleTickerProviderStateMixin {
  final MapController _mapController = MapController();
  LatLng _currentLocation = const LatLng(
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
        SnackBar(content: Text(driver.error!), backgroundColor: kErrorDeep),
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
    } else if (mounted) {
      setState(() => _locationLoading = false);
      final reason = await locationService.checkUnavailableReason();
      _showLocationError(reason);
    }
  }

  // Without this, a permission/GPS failure silently falls back to a hardcoded
  // Angren-center coordinate with no indication to the driver why the map
  // shows the wrong place.
  void _showLocationError(LocationUnavailableReason reason) {
    if (!mounted) return;
    final message = switch (reason) {
      LocationUnavailableReason.serviceDisabled =>
        "Telefoningizda joylashuv (GPS) o'chirilgan — xarita to'g'ri ishlashi uchun uni yoqing.",
      LocationUnavailableReason.permissionDenied ||
      LocationUnavailableReason.permissionDeniedForever =>
        "Ilova joylashuvga ruxsat olmadi — xaritada aniq joyingizni ko'rish uchun ruxsat bering.",
      LocationUnavailableReason.timeoutOrError =>
        "Joylashuvni aniqlab bo'lmadi. Ochiq joyga o'ting yoki qayta urinib ko'ring.",
    };
    final actionLabel = switch (reason) {
      LocationUnavailableReason.serviceDisabled => 'Yoqish',
      LocationUnavailableReason.permissionDenied ||
      LocationUnavailableReason.permissionDeniedForever =>
        'Sozlamalar',
      LocationUnavailableReason.timeoutOrError => 'Qayta urinish',
    };
    final VoidCallback onAction = switch (reason) {
      LocationUnavailableReason.serviceDisabled => () => Geolocator.openLocationSettings(),
      LocationUnavailableReason.permissionDenied ||
      LocationUnavailableReason.permissionDeniedForever =>
        () => Geolocator.openAppSettings(),
      LocationUnavailableReason.timeoutOrError => () {
          setState(() => _locationLoading = true);
          _initLocation();
        },
    };
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: kWarningDeep,
        duration: const Duration(seconds: 8),
        action: SnackBarAction(
          label: actionLabel,
          textColor: kOnPrimary,
          onPressed: onAction,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<DriverProvider>(
        builder: (context, driverProvider, _) {
          return Stack(
            children: [
              _buildMap(driverProvider),
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
                  // Mint TO'LDIRISH ustida faqat ink ikona (7.84:1).
                  color: driverProvider.isOnline ? kMint : kInkSubtle,
                  shape: BoxShape.circle,
                  border: Border.all(color: kSurface, width: 3),
                  boxShadow: kShadowCard,
                ),
                child: Icon(
                  Icons.local_taxi,
                  color: driverProvider.isOnline ? kOnMint : kOnPrimary,
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
        padding: const EdgeInsets.all(kSpace4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Semantics(
              button: true,
              label: 'Menyu',
              child: Container(
                constraints: const BoxConstraints(
                  minHeight: kMinTapTarget,
                  minWidth: kMinTapTarget,
                ),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: kShadowCard,
                ),
                child: Consumer<AuthProvider>(
                  builder: (context, auth, _) => IconButton(
                    icon: const Icon(Icons.menu, color: kInk),
                    onPressed: () => _showMenu(context, auth, driverProvider),
                  ),
                ),
              ),
            ),
            // Holat faqat rang bilan berilmaydi: ikonka + matn + rang.
            // Oldin mint fon ustida OQ matn (2.12:1) edi.
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(kRadiusXs),
                boxShadow: kShadowCard,
              ),
              child: AppStatusBadge(
                label: driverProvider.isOnline ? 'Online' : 'Offline',
                tone: driverProvider.isOnline
                    ? AppStatusTone.success
                    : AppStatusTone.neutral,
              ),
            ),
            Semantics(
              button: true,
              label: 'Joylashuvimni topish',
              child: Container(
                constraints: const BoxConstraints(
                  minHeight: kMinTapTarget,
                  minWidth: kMinTapTarget,
                ),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: kShadowCard,
                ),
                child: IconButton(
                  icon: const Icon(Icons.my_location, color: kInk),
                  onPressed: _initLocation,
                ),
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
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace5, kSpace4, kSpace8),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(kRadiusXl),
          ),
          boxShadow: kShadowPop,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ExcludeSemantics(
              child: SizedBox(
                width: 40,
                height: 4,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: kLineStrong,
                    borderRadius: BorderRadius.all(Radius.circular(kRadiusFull)),
                  ),
                ),
              ),
            ),
            const SizedBox(height: kSpace5),
            // Uch holat: yuklanmoqda → skeleton, faol buyurtma → karta,
            // bo'sh → onlayn toggle bloki.
            if (_locationLoading)
              const AppSkeletonList(
                itemCount: 2,
                hasTrailing: true,
                padding: EdgeInsets.zero,
              )
            else if (driverProvider.hasActiveOrder)
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
          const Column(
            children: [
              Text(
                'Ishlashni boshlash',
                style: TextStyle(
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              SizedBox(height: kSpace1),
              Text(
                'Online holatga o\'ting va buyurtmalar qabul qiling',
                style: TextStyle(color: kInkMuted, fontSize: kFontLabel),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        const SizedBox(height: kSpace5),
        _buildEarningsRow(driverProvider),
        const SizedBox(height: kSpace5),
        Semantics(
          button: true,
          toggled: isOnline,
          enabled: !isLoading,
          label: isOnline ? "Offline bo'lish" : "Online bo'lish",
          value: isOnline ? 'Online' : 'Offline',
          excludeSemantics: true,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: isLoading
                ? null
                : (isOnline
                    ? driverProvider.goOffline
                    : driverProvider.goOnline),
            child: Container(
              width: double.infinity,
              height: kControlHeight,
              decoration: BoxDecoration(
                // Faol toggle = to'q yashil CTA gradienti (oq matn 5.38:1).
                gradient: isOnline ? null : kGradientCta,
                color: isOnline ? kInk : null,
                borderRadius: BorderRadius.circular(kRadiusMd),
                boxShadow: isOnline ? kShadowInk : kShadowCta,
              ),
              alignment: Alignment.center,
              child: isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(kOnPrimary),
                      ),
                    )
                  : Text(
                      isOnline ? "Offline bo'lish" : "Online bo'lish",
                      style: const TextStyle(
                        fontSize: kFontTitle,
                        fontWeight: FontWeight.w700,
                        color: kOnPrimary,
                      ),
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
          child: const ExcludeSemantics(
            child: SizedBox(
              width: 72,
              height: 72,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: kMintTint,
                  shape: BoxShape.circle,
                  border: Border.fromBorderSide(
                    BorderSide(color: kPrimary, width: 2),
                  ),
                ),
                child: Icon(Icons.wifi, color: kPrimary, size: 32),
              ),
            ),
          ),
        ),
        const SizedBox(height: kSpace3),
        const Text(
          'Buyurtma kutilmoqda...',
          style: TextStyle(
            fontSize: kFontTitle,
            fontWeight: FontWeight.w700,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace1),
        const Text(
          // Yorug' fondagi ma'noli yashil matn — kPrimary (mint 2.12:1).
          'Siz online holatdasiz',
          style: TextStyle(color: kPrimary, fontSize: kFontLabel),
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
        const SizedBox(width: kSpace3),
        Expanded(
          child: Semantics(
            button: true,
            label: "Tarix, ko'rish",
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => Navigator.of(context).pushNamed('/driver/earnings'),
              child: ConstrainedBox(
                constraints: const BoxConstraints(minHeight: kMinTapTarget),
                child: const _EarningChip(
                  icon: Icons.history,
                  label: 'Tarix',
                  value: "Ko'rish",
                ),
              ),
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
          padding: const EdgeInsets.all(kSpace4),
          decoration: BoxDecoration(
            color: kSurface2,
            borderRadius: BorderRadius.circular(kRadiusMd),
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Faol buyurtma',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: kFontBodyLg,
                      color: kInk,
                    ),
                  ),
                  // Ikonka + matn + rang — holat faqat rangda qolmaydi.
                  AppStatusBadge(
                    label: order.status.label,
                    tone: AppStatusTone.info,
                    dense: true,
                  ),
                ],
              ),
              const SizedBox(height: kSpace3),
              _buildOrderRouteRow(
                Icons.radio_button_checked,
                kPrimary,
                order.pickup.address,
              ),
              const SizedBox(height: kSpace1 + 2),
              _buildOrderRouteRow(
                Icons.location_on,
                kError,
                order.dropoff.address,
              ),
              const Divider(height: kSpace4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    Formatters.formatPrice(order.estimatedPrice),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: kFontTitle,
                      color: kInk,
                    ),
                  ),
                  ElevatedButton(
                    onPressed: () => _navigateToActiveOrder(driverProvider),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: kInk,
                      foregroundColor: kOnPrimary,
                      minimumSize: const Size(0, kControlHeightSm),
                      padding: const EdgeInsets.symmetric(
                        horizontal: kSpace4,
                        vertical: kSpace3,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(kRadiusMd),
                      ),
                      textStyle: const TextStyle(
                        fontSize: kFontTitle,
                        fontWeight: FontWeight.w700,
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
        ExcludeSemantics(child: Icon(icon, color: color, size: 16)),
        const SizedBox(width: kSpace2),
        Expanded(
          child: Text(
            text,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: kFontLabel, color: kInk),
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
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const CircleAvatar(
                backgroundColor: kSurface2,
                child: Icon(Icons.person, color: kInk),
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
              title: const Text('Chiqish', style: TextStyle(color: kErrorDeep)),
              onTap: () {
                Navigator.of(ctx).pop();
                auth.logout();
              },
            ),
            const SizedBox(height: kSpace2),
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
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusSm),
      ),
      child: Row(
        children: [
          ExcludeSemantics(child: Icon(icon, color: kPrimary, size: 20)),
          const SizedBox(width: kSpace2),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: kInkMuted,
                  fontSize: kFontMicro,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: kFontLabel,
                  color: kInk,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
