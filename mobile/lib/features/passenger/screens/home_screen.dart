import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/rate_driver_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

class PassengerHomeScreen extends StatefulWidget {
  const PassengerHomeScreen({super.key});

  @override
  State<PassengerHomeScreen> createState() => _PassengerHomeScreenState();
}

class _PassengerHomeScreenState extends State<PassengerHomeScreen> {
  final MapController _mapController = MapController();
  LatLng _currentLocation = LatLng(
    AppConfig.defaultLat,
    AppConfig.defaultLng,
  );
  bool _locationLoading = true;

  @override
  void initState() {
    super.initState();
    _initLocation();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrderProvider>().checkActiveOrder();
    });
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

  void _onWhereToTap() {
    final orderProvider = context.read<OrderProvider>();
    orderProvider.setPendingPickup(
      OrderLocation(
        address: 'Joylashuv aniqlanmoqda...',
        lat: _currentLocation.latitude,
        lng: _currentLocation.longitude,
      ),
    );
    Navigator.of(context).pushNamed('/passenger/destination');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<OrderProvider>(
        builder: (context, orderProvider, _) {
          // After a trip completes the provider flags a pending rating. Present
          // the rating screen as a modal over the home view, once.
          if (orderProvider.pendingRatingOrderId != null) {
            final orderId = orderProvider.pendingRatingOrderId!;
            final driverName =
                orderProvider.pendingRatingDriverName ?? 'Haydovchi';
            WidgetsBinding.instance.addPostFrameCallback((_) {
              orderProvider.clearPendingRating();
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  fullscreenDialog: true,
                  builder: (_) => RateDriverScreen(
                    orderId: orderId,
                    driverName: driverName,
                  ),
                ),
              );
            });
          }
          if (orderProvider.hasActiveOrder) {
            return _buildActiveOrderView(orderProvider);
          }
          return _buildSearchView();
        },
      ),
    );
  }

  Widget _buildSearchView() {
    return Stack(
      children: [
        _buildMap(),
        _buildTopBar(),
        if (_locationLoading) const LoadingWidget(),
        _buildBottomSheet(),
      ],
    );
  }

  Widget _buildMap() {
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
              width: 40,
              height: 40,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.blue.shade700,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.blue.shade700.withAlpha(100),
                      blurRadius: 8,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Icon(Icons.person, color: Colors.white, size: 20),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTopBar() {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            // Frosted-glass profile button
            Consumer<AuthProvider>(
              builder: (context, auth, _) {
                return GestureDetector(
                  onTap: () => _showMenu(context, auth),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                      child: Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: kSurface.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: kInk.withValues(alpha: 0.1),
                              blurRadius: 12,
                            ),
                          ],
                        ),
                        child: const Icon(Icons.menu_rounded, color: kInk),
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(width: 12),
            // Location pill
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 13),
                    decoration: BoxDecoration(
                      color: kSurface.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: kInk.withValues(alpha: 0.1),
                          blurRadius: 12,
                        ),
                      ],
                    ),
                    child: Row(
                      children: const [
                        Icon(Icons.my_location_rounded,
                            color: kPrimary, size: 20),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Joriy joylashuv',
                            style: TextStyle(
                              color: kTextPrimary,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.4, curve: Curves.easeOut);
  }

  Widget _buildBottomSheet() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
          boxShadow: [
            BoxShadow(
              color: kInk.withValues(alpha: 0.12),
              blurRadius: 24,
              offset: const Offset(0, -6),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 5,
                decoration: BoxDecoration(
                  color: kSurfaceGrey,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Qayoqqa boramiz?',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: kTextPrimary,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 16),
            // Prominent search field
            GestureDetector(
              onTap: _onWhereToTap,
              child: Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 14),
                decoration: BoxDecoration(
                  color: kSurfaceGrey,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [kPrimary, kPrimaryDark],
                        ),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.search_rounded,
                          color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Manzilni qidiring...',
                        style:
                            TextStyle(color: kTextSecondary, fontSize: 15),
                      ),
                    ),
                    const Icon(Icons.arrow_forward_ios_rounded,
                        size: 14, color: kTextSecondary),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              'Saqlangan joylar',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: kTextPrimary,
              ),
            ),
            const SizedBox(height: 12),
            _buildSavedPlaces(),
          ],
        ),
      ),
    ).animate().slideY(
          begin: 1,
          end: 0,
          duration: 500.ms,
          curve: Curves.easeOutCubic,
        );
  }

  Widget _buildSavedPlaces() {
    final places = [
      ('Uy', Icons.home_rounded, const Color(0xFF1FCA8E)),
      ('Ish', Icons.work_rounded, const Color(0xFF3B82F6)),
      ('Bozor', Icons.shopping_basket_rounded, const Color(0xFFF59E0B)),
      ('Qo\'shish', Icons.add_rounded, kTextSecondary),
    ];

    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: places.length,
        separatorBuilder: (_, __) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final p = places[i];
          return GestureDetector(
            onTap: _onWhereToTap,
            child: Container(
              width: 80,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: kSurfaceGrey,
                borderRadius: BorderRadius.circular(kRadiusMd),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: p.$3.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Icon(p.$2, color: p.$3, size: 22),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    p.$1,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: kTextPrimary,
                    ),
                  ),
                ],
              ),
            ),
          )
              .animate()
              .fadeIn(delay: (200 + i * 80).ms, duration: 350.ms)
              .slideX(begin: 0.3, curve: Curves.easeOut);
        },
      ),
    );
  }

  Widget _buildActiveOrderView(OrderProvider orderProvider) {
    final order = orderProvider.activeOrder!;

    return Stack(
      children: [
        _buildTrackingMap(orderProvider),
        _buildTopBar(),
        _buildActiveOrderBottomCard(order, orderProvider),
      ],
    );
  }

  Widget _buildTrackingMap(OrderProvider orderProvider) {
    final markers = <Marker>[
      Marker(
        point: LatLng(
          orderProvider.activeOrder!.pickup.lat,
          orderProvider.activeOrder!.pickup.lng,
        ),
        width: 40,
        height: 40,
        child: const Icon(
          Icons.location_on,
          color: Colors.green,
          size: 40,
        ),
      ),
      Marker(
        point: LatLng(
          orderProvider.activeOrder!.dropoff.lat,
          orderProvider.activeOrder!.dropoff.lng,
        ),
        width: 40,
        height: 40,
        child: const Icon(
          Icons.flag,
          color: kError,
          size: 40,
        ),
      ),
    ];

    if (orderProvider.driverLocation != null) {
      markers.add(
        Marker(
          point: orderProvider.driverLocation!,
          width: 44,
          height: 44,
          child: Container(
            decoration: BoxDecoration(
              color: kPrimaryYellow,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 2),
              boxShadow: const [
                BoxShadow(color: Colors.black26, blurRadius: 6),
              ],
            ),
            child: const Icon(Icons.local_taxi, color: Colors.black, size: 24),
          ),
        ),
      );
    }

    return FlutterMap(
      options: MapOptions(
        initialCenter: LatLng(
          orderProvider.activeOrder!.pickup.lat,
          orderProvider.activeOrder!.pickup.lng,
        ),
        initialZoom: 14,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'uz.angren.taxi',
        ),
        MarkerLayer(markers: markers),
      ],
    );
  }

  Widget _buildActiveOrderBottomCard(
    Order order,
    OrderProvider orderProvider,
  ) {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: [
            BoxShadow(color: Colors.black12, blurRadius: 12),
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
            const SizedBox(height: 16),
            _buildStatusChip(order.status),
            const SizedBox(height: 12),
            if (order.driver != null) _buildDriverInfo(order),
            const SizedBox(height: 12),
            _buildRouteInfo(order),
            if (order.status == OrderStatus.searching ||
                order.status == OrderStatus.driverAssigned) ...[
              const SizedBox(height: 16),
              AppButton(
                label: 'Bekor qilish',
                onPressed: () => _confirmCancel(orderProvider),
                backgroundColor: kError,
                foregroundColor: Colors.white,
                isLoading:
                    orderProvider.state == OrderProviderState.loading,
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusChip(OrderStatus status) {
    Color color;
    switch (status) {
      case OrderStatus.searching:
        color = Colors.orange;
      case OrderStatus.driverAssigned:
      case OrderStatus.driverEnRoute:
        color = Colors.blue;
      case OrderStatus.driverArrived:
        color = Colors.green;
      case OrderStatus.inProgress:
        color = kPrimaryYellow;
      default:
        color = kTextSecondary;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withAlpha(30),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withAlpha(100)),
      ),
      child: Text(
        status.label,
        style: TextStyle(
          color: color,
          fontWeight: FontWeight.w600,
          fontSize: 13,
        ),
      ),
    );
  }

  Future<void> _callDriver(String phone) async {
    if (phone.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: phone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Qo'ng'iroq qilib bo'lmadi")),
      );
    }
  }

  Widget _buildDriverInfo(Order order) {
    final driver = order.driver!;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          // Gradient-ring avatar
          Container(
            padding: const EdgeInsets.all(2.5),
            decoration: const BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(colors: [kPrimary, kPrimaryDark]),
            ),
            child: const CircleAvatar(
              radius: 24,
              backgroundColor: kSurface,
              child: Icon(Icons.person_rounded, color: kPrimaryDark, size: 26),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  driver.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  driver.carInfo,
                  style: const TextStyle(color: kTextSecondary, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.star_rounded,
                        color: Color(0xFFF5A623), size: 16),
                    const SizedBox(width: 4),
                    Text(
                      Formatters.formatRating(driver.rating),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Filled call button
          GestureDetector(
            onTap: () => _callDriver(driver.phone),
            child: Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [kPrimary, kPrimaryDark]),
                borderRadius: BorderRadius.circular(14),
                boxShadow: [
                  BoxShadow(
                    color: kPrimary.withValues(alpha: 0.4),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(Icons.phone_rounded, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRouteInfo(Order order) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.location_on, color: Colors.green, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  order.pickup.address,
                  style: const TextStyle(fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.flag, color: kError, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  order.dropoff.address,
                  style: const TextStyle(fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                Formatters.formatPrice(order.estimatedPrice),
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  color: kTextPrimary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _confirmCancel(OrderProvider orderProvider) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Bekor qilishni tasdiqlang'),
        content: const Text('Buyurtmani bekor qilmoqchimisiz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("Yo'q"),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              orderProvider.cancelOrder();
            },
            child: const Text(
              'Ha, bekor qilish',
              style: TextStyle(color: kError),
            ),
          ),
        ],
      ),
    );
  }

  void _showMenu(BuildContext context, AuthProvider auth) {
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
              title: Text(auth.currentUser?.displayName ?? 'Foydalanuvchi'),
              subtitle: Text(auth.currentUser?.phone ?? ''),
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.history),
              title: const Text('Sayohat tarixi'),
              onTap: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pushNamed('/passenger/history');
              },
            ),
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('Profil'),
              onTap: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pushNamed('/passenger/profile');
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
