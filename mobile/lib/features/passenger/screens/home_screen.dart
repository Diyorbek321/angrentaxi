import 'dart:ui';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/favorites_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/destination_screen.dart';
import 'package:angren_taxi/features/passenger/screens/rate_driver_screen.dart';
import 'package:angren_taxi/features/trip/screens/trip_chat_screen.dart';
import 'package:angren_taxi/shared/models/favorite_address.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class PassengerHomeScreen extends StatefulWidget {
  const PassengerHomeScreen({super.key, this.sosService});

  /// Injectable for tests — defaults to a [SosService] built from the real
  /// [ApiClient] in the service locator (same pattern as
  /// CheckoutScreen.paymentService).
  final SosService? sosService;

  @override
  State<PassengerHomeScreen> createState() => _PassengerHomeScreenState();
}

class _PassengerHomeScreenState extends State<PassengerHomeScreen> {
  final MapController _mapController = MapController();
  LatLng _currentLocation = const LatLng(
    AppConfig.defaultLat,
    AppConfig.defaultLng,
  );
  bool _locationLoading = true;

  SosService get _sosService =>
      widget.sosService ?? SosService(apiClient: sl<ApiClient>());

  @override
  void initState() {
    super.initState();
    _initLocation();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrderProvider>().checkActiveOrder();
      context.read<FavoritesProvider>().loadFavorites();
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
          if (orderProvider.noDriversFoundMessage != null) {
            final message = orderProvider.noDriversFoundMessage!;
            WidgetsBinding.instance.addPostFrameCallback((_) {
              orderProvider.clearNoDriversFoundMessage();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(message), backgroundColor: kErrorDeep),
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
                  color: kInfoDeep,
                  shape: BoxShape.circle,
                  border: Border.all(color: kSurface, width: 3),
                  // Rangli "halo" — elevatsiya emas, shuning uchun
                  // kShadow* tokenlari mos kelmaydi.
                  boxShadow: [
                    BoxShadow(
                      color: kInfoDeep.withValues(alpha: 0.4),
                      blurRadius: 8,
                      spreadRadius: 2,
                    ),
                  ],
                ),
                child: const Icon(Icons.person, color: kOnPrimary, size: 20),
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
        padding: const EdgeInsets.all(kSpace4),
        child: Row(
          children: [
            // Frosted-glass profile button
            Consumer<AuthProvider>(
              builder: (context, auth, _) {
                return Semantics(
                  button: true,
                  label: 'Menyu',
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: () => _showMenu(context, auth),
                    behavior: HitTestBehavior.opaque,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(
                        minHeight: kMinTapTarget,
                        minWidth: kMinTapTarget,
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(kRadiusMd),
                        child: BackdropFilter(
                          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                          child: Container(
                            width: kMinTapTarget,
                            height: kMinTapTarget,
                            decoration: BoxDecoration(
                              color: kSurface.withValues(alpha: 0.85),
                              borderRadius: BorderRadius.circular(kRadiusMd),
                              boxShadow: kShadowCard,
                            ),
                            child: const Icon(Icons.menu_rounded, color: kInk),
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
            const SizedBox(width: kSpace3),
            // Location pill
            Expanded(
              child: ClipRRect(
                borderRadius: BorderRadius.circular(kRadiusMd),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: kSpace4, vertical: kSpace3 + 1),
                    decoration: BoxDecoration(
                      color: kSurface.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(kRadiusMd),
                      boxShadow: kShadowCard,
                    ),
                    child: const Row(
                      children: [
                        ExcludeSemantics(
                          child: Icon(Icons.my_location_rounded,
                              color: kPrimary, size: 20),
                        ),
                        SizedBox(width: kSpace3),
                        Expanded(
                          child: Text(
                            'Joriy joylashuv',
                            style: TextStyle(
                              color: kInk,
                              fontSize: kFontBody,
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
        padding: const EdgeInsets.fromLTRB(kSpace5, kSpace3, kSpace5, kSpace8),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: const BorderRadius.vertical(
            top: Radius.circular(kRadiusXl),
          ),
          boxShadow: kShadowPop,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: ExcludeSemantics(
                child: Container(
                  width: 44,
                  height: 5,
                  decoration: BoxDecoration(
                    color: kSurface2,
                    borderRadius: BorderRadius.circular(kRadiusFull),
                  ),
                ),
              ),
            ),
            const SizedBox(height: kSpace5),
            const Text(
              'Qayoqqa boramiz?',
              style: TextStyle(
                fontSize: kFontH1,
                fontWeight: FontWeight.w800,
                color: kInk,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: kSpace4),
            // Prominent search field
            Semantics(
              button: true,
              label: 'Manzilni qidiring',
              excludeSemantics: true,
              child: GestureDetector(
                onTap: _onWhereToTap,
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: kSpace4, vertical: kSpace4),
                  decoration: BoxDecoration(
                    color: kSurface2,
                    borderRadius: BorderRadius.circular(kRadiusMd),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 38,
                        height: 38,
                        decoration: BoxDecoration(
                          gradient: kGradientCta,
                          borderRadius: BorderRadius.circular(kRadiusSm),
                        ),
                        child: const Icon(Icons.search_rounded,
                            color: kOnPrimary, size: 22),
                      ),
                      const SizedBox(width: kSpace3),
                      const Expanded(
                        child: Text(
                          'Manzilni qidiring...',
                          style: TextStyle(
                              color: kInkMuted, fontSize: kFontTitle),
                        ),
                      ),
                      const Icon(Icons.arrow_forward_ios_rounded,
                          size: 14, color: kInkMuted),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: kSpace5),
            const Text(
              'Saqlangan joylar',
              style: TextStyle(
                fontSize: kFontBody,
                fontWeight: FontWeight.w700,
                color: kInk,
              ),
            ),
            const SizedBox(height: kSpace3),
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

  /// Sends the passenger straight to tariff selection with both ends of the
  /// trip already known — the "Qo'shish" tile is the only saved-places tile
  /// that still goes through [_onWhereToTap]'s search flow.
  void _onFavoriteTap(FavoriteAddress favorite) {
    final orderProvider = context.read<OrderProvider>();
    orderProvider.setPendingPickup(
      OrderLocation(
        address: 'Joriy joylashuv',
        lat: _currentLocation.latitude,
        lng: _currentLocation.longitude,
      ),
    );
    orderProvider.setPendingDropoff(
      OrderLocation(
        address: favorite.address,
        lat: favorite.lat,
        lng: favorite.lng,
      ),
    );
    Navigator.of(context).pushNamed('/passenger/tariff');
  }

  /// Opens the destination search in "pick a location to save" mode instead
  /// of the normal search-and-order flow.
  void _onAddFavoriteTap() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const DestinationScreen(isSavingFavorite: true),
      ),
    );
  }

  Widget _buildSavedPlaces() {
    return Consumer<FavoritesProvider>(
      builder: (context, favoritesProvider, _) {
        final favorites = favoritesProvider.favorites;
        final itemCount = favorites.length + 1; // + trailing "Qo'shish" tile

        return SizedBox(
          // 96 was too tight for the icon + label column below (42 + 8
          // spacing + label text + 24 vertical padding), overflowing by
          // ~12px once a test actually settles this view; 108 gives the
          // label enough room.
          height: 108,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: itemCount,
            separatorBuilder: (_, __) => const SizedBox(width: kSpace3),
            itemBuilder: (context, i) {
              if (i == favorites.length) {
                return _buildSavedPlaceTile(
                  index: i,
                  label: "Qo'shish",
                  icon: Icons.add_rounded,
                  color: kInkMuted,
                  onTap: _onAddFavoriteTap,
                );
              }
              final favorite = favorites[i];
              return _buildSavedPlaceTile(
                index: i,
                label: favorite.label,
                icon: favorite.icon,
                color: favorite.color,
                onTap: () => _onFavoriteTap(favorite),
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildSavedPlaceTile({
    required int index,
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 80,
          padding: const EdgeInsets.all(kSpace3),
          decoration: BoxDecoration(
            color: kSurface2,
            borderRadius: BorderRadius.circular(kRadiusMd),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              ExcludeSemantics(
                child: Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: Icon(icon, color: color, size: 22),
                ),
              ),
              const SizedBox(height: kSpace2),
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: kFontCaption,
                  fontWeight: FontWeight.w600,
                  color: kInk,
                ),
              ),
            ],
          ),
        ),
      ),
    )
        .animate()
        .fadeIn(delay: (200 + index * 80).ms, duration: 350.ms)
        .slideX(begin: 0.3, curve: Curves.easeOut);
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
          color: kPrimary,
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
              // Mint to'ldirish — ustidagi ikona ink (7.84:1), oq emas.
              color: kMint,
              shape: BoxShape.circle,
              border: Border.all(color: kSurface, width: 2),
              boxShadow: kShadowCard,
            ),
            child: const Icon(Icons.local_taxi, color: kOnMint, size: 24),
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
        padding: const EdgeInsets.fromLTRB(kSpace5, kSpace4, kSpace5, kSpace8),
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
            ExcludeSemantics(
              child: Container(
                width: kSpace10,
                height: kSpace1,
                decoration: BoxDecoration(
                  color: kLineStrong,
                  borderRadius: BorderRadius.circular(kRadiusFull),
                ),
              ),
            ),
            const SizedBox(height: kSpace4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildStatusChip(order.status),
                _buildSosButton(order),
              ],
            ),
            _buildEtaBanner(order, orderProvider),
            const SizedBox(height: kSpace3),
            if (order.driver != null) _buildDriverInfo(order),
            const SizedBox(height: kSpace3),
            _buildRouteInfo(order),
            if (order.status == OrderStatus.searching ||
                order.status == OrderStatus.driverAssigned) ...[
              const SizedBox(height: kSpace4),
              AppButton(
                label: 'Bekor qilish',
                onPressed: () => _confirmCancel(orderProvider),
                backgroundColor: kError,
                foregroundColor: kOnPrimary,
                isLoading:
                    orderProvider.state == OrderProviderState.loading,
              ),
            ],
          ],
        ),
      ),
    );
  }

  /// Safar holati faqat RANG bilan berilmaydi — `AppStatusBadge` ikonka,
  /// matn va rangni birga tashiydi (WCAG 1.4.1).
  Widget _buildStatusChip(OrderStatus status) {
    final tone = switch (status) {
      OrderStatus.searching => AppStatusTone.warning,
      OrderStatus.driverAssigned ||
      OrderStatus.driverEnRoute =>
        AppStatusTone.info,
      OrderStatus.driverArrived ||
      OrderStatus.inProgress ||
      OrderStatus.completed =>
        AppStatusTone.success,
      OrderStatus.cancelled => AppStatusTone.danger,
      _ => AppStatusTone.neutral,
    };
    return AppStatusBadge(label: status.label, tone: tone);
  }

  /// Small red circular SOS button shown in the active-order status row.
  /// Opens [_showSosSheet] with emergency-call and dispatcher-alert options.
  Widget _buildSosButton(Order order) {
    return Semantics(
      button: true,
      label: 'SOS — favqulodda yordam',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () => _showSosSheet(order),
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinTapTarget,
            minWidth: kMinTapTarget,
          ),
          child: Center(
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: kError,
                shape: BoxShape.circle,
                // Qizil "halo" — kShadowCta yashil, bu yerga mos emas.
                boxShadow: [
                  BoxShadow(
                    color: kError.withValues(alpha: 0.4),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(Icons.sos_rounded, color: kOnPrimary, size: 20),
            ),
          ),
        ),
      ),
    );
  }

  // Emergency services number (Uzbekistan combined police/fire line). The
  // sheet also mentions 103 (ambulance) in its label, but tel: only accepts
  // a single number to dial.
  static const String _emergencyPhoneNumber = '102';

  Future<void> _callEmergency() async {
    final uri = Uri(scheme: 'tel', path: _emergencyPhoneNumber);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Qo'ng'iroq qilib bo'lmadi")),
      );
    }
  }

  Future<void> _alertDispatchers(String orderId) async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    final lat = position?.latitude ?? _currentLocation.latitude;
    final lng = position?.longitude ?? _currentLocation.longitude;
    try {
      await _sosService.reportSos(orderId: orderId, lat: lat, lng: lng);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Dispetcherlarga xabar yuborildi'),
            backgroundColor: kPrimary,
          ),
        );
      }
    } on SosException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message)),
        );
      }
    }
  }

  void _showSosSheet(Order order) {
    showModalBottomSheet<void>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(
              kSpace5, kSpace5, kSpace5, kSpace6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Favqulodda yordam',
                style: TextStyle(
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              const SizedBox(height: kSpace1 + 2),
              const Text(
                "Xavfsizligingiz biz uchun muhim. Kerak bo'lsa, quyidagi "
                'tugmalardan birini bosing.',
                style: TextStyle(color: kInkMuted, fontSize: kFontLabel),
              ),
              const SizedBox(height: kSpace5),
              AppButton(
                label: 'Favqulodda chaqiruv (102/103)',
                backgroundColor: kError,
                foregroundColor: kOnPrimary,
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _callEmergency();
                },
              ),
              const SizedBox(height: kSpace3),
              AppButton(
                label: 'Dispetcherlarga xabar berish',
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  _alertDispatchers(order.id);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Rough ETA (in minutes) from the driver's live location to the pickup
  /// point, assuming an average city driving speed of 25 km/h. Only
  /// meaningful before the driver has arrived — once `driverArrived` (or
  /// later), there's nothing left to count down to.
  static const double _averageCitySpeedKmh = 25;

  int? _etaMinutesToPickup(Order order, OrderProvider orderProvider) {
    if (order.status != OrderStatus.driverAssigned &&
        order.status != OrderStatus.driverEnRoute) {
      return null;
    }
    final driverLocation = orderProvider.driverLocation;
    if (driverLocation == null) return null;

    const distanceCalculator = Distance();
    final distanceKm = distanceCalculator.as(
      LengthUnit.Kilometer,
      driverLocation,
      LatLng(order.pickup.lat, order.pickup.lng),
    );
    final minutes = (distanceKm / _averageCitySpeedKmh) * 60;
    return minutes.round();
  }

  Widget _buildEtaBanner(Order order, OrderProvider orderProvider) {
    final etaMinutes = _etaMinutesToPickup(order, orderProvider);
    if (etaMinutes == null) return const SizedBox.shrink();

    final text = etaMinutes < 1
        ? 'Haydovchi deyarli yetib keldi'
        : 'Haydovchi $etaMinutes daqiqada yetib keladi';

    return Padding(
      padding: const EdgeInsets.only(top: kSpace2),
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: kSpace3, vertical: kSpace2),
        decoration: BoxDecoration(
          // Mint tinted yuza — ustidagi matn/ikona kPrimary (5.38:1).
          color: kMintTint,
          borderRadius: BorderRadius.circular(kRadiusSm),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const ExcludeSemantics(
              child:
                  Icon(Icons.access_time_rounded, size: 16, color: kPrimary),
            ),
            const SizedBox(width: kSpace1 + 2),
            Text(
              text,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: kFontLabel,
                color: kPrimary,
              ),
            ),
          ],
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

  void _openChat(Order order) {
    final currentUserId = context.read<AuthProvider>().currentUser?.id;
    if (currentUserId == null) return;
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => TripChatScreen(
          orderId: order.id,
          currentUserId: currentUserId,
        ),
      ),
    );
  }

  Widget _buildDriverInfo(Order order) {
    final driver = order.driver!;
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          // ATAYLAB SAQLANADI: haydovchi avatarining mint gradient halqasi —
          // sof dekorativ, ma'no tashimaydi.
          const ExcludeSemantics(
            child: Padding(
              padding: EdgeInsets.all(2.5),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: kGradientMint,
                ),
                child: CircleAvatar(
                  radius: 24,
                  backgroundColor: kSurface,
                  child:
                      Icon(Icons.person_rounded, color: kPrimary, size: 26),
                ),
              ),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  driver.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: kFontTitle,
                    color: kInk,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  driver.carInfo,
                  style: const TextStyle(
                      color: kInkMuted, fontSize: kFontLabel),
                ),
                const SizedBox(height: kSpace1),
                Row(
                  children: [
                    const ExcludeSemantics(
                      child: Icon(Icons.star_rounded,
                          color: kWarningDeep, size: 16),
                    ),
                    const SizedBox(width: kSpace1),
                    Text(
                      Formatters.formatRating(driver.rating),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: kFontLabel,
                        color: kInk,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Chat button — opens in-trip messaging with the driver.
          Semantics(
            button: true,
            label: 'Haydovchi bilan yozishish',
            excludeSemantics: true,
            child: GestureDetector(
              onTap: () => _openChat(order),
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: kMinTapTarget,
                height: kMinTapTarget,
                margin: const EdgeInsets.only(right: kSpace3),
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  border: Border.all(color: kLine, width: 1.5),
                ),
                child: const Icon(Icons.chat_bubble_outline_rounded,
                    color: kPrimary),
              ),
            ),
          ),
          // Filled call button
          Semantics(
            button: true,
            label: "Haydovchiga qo'ng'iroq qilish",
            excludeSemantics: true,
            child: GestureDetector(
              onTap: () => _callDriver(driver.phone),
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: kMinTapTarget,
                height: kMinTapTarget,
                decoration: BoxDecoration(
                  gradient: kGradientCta,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: kShadowCta,
                ),
                child: const Icon(Icons.phone_rounded, color: kOnPrimary),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRouteInfo(Order order) {
    return Container(
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusSm),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.location_on, color: kPrimary, size: 18),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  order.pickup.address,
                  style: const TextStyle(fontSize: kFontLabel, color: kInk),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace1),
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.flag, color: kError, size: 18),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  order.dropoff.address,
                  style: const TextStyle(fontSize: kFontLabel, color: kInk),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Text(
                Formatters.formatPrice(order.estimatedPrice),
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static const List<String> _cancelReasons = [
    'Juda uzoq kutdim',
    "Fikrimni o'zgartirdim",
    'Narx juda qimmat',
    'Boshqa sabab',
  ];
  static const String _otherCancelReason = 'Boshqa sabab';

  void _confirmCancel(OrderProvider orderProvider) {
    String selectedReason = _cancelReasons.first;
    final customReasonController = TextEditingController();

    showDialog<void>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          return AlertDialog(
            title: const Text('Bekor qilish sababi'),
            content: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Buyurtmani bekor qilish sababini tanlang:',
                    style: TextStyle(color: kInkMuted, fontSize: kFontLabel),
                  ),
                  for (final reason in _cancelReasons)
                    RadioListTile<String>(
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                      value: reason,
                      groupValue: selectedReason,
                      title: Text(reason),
                      onChanged: (value) {
                        if (value != null) {
                          setDialogState(() => selectedReason = value);
                        }
                      },
                    ),
                  if (selectedReason == _otherCancelReason)
                    Padding(
                      padding: const EdgeInsets.only(
                          top: kSpace1, bottom: kSpace1),
                      child: TextField(
                        controller: customReasonController,
                        autofocus: true,
                        maxLines: 2,
                        decoration: const InputDecoration(
                          hintText: 'Sababni yozing...',
                          border: OutlineInputBorder(),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text("Yo'q"),
              ),
              TextButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  final reason = selectedReason == _otherCancelReason
                      ? customReasonController.text.trim()
                      : selectedReason;
                  orderProvider.cancelOrder(
                    reason: reason.isEmpty ? null : reason,
                  );
                },
                child: const Text(
                  'Ha, bekor qilish',
                  style: TextStyle(color: kErrorDeep),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  void _showMenu(BuildContext context, AuthProvider auth) {
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
              leading: const ExcludeSemantics(
                child: CircleAvatar(
                  backgroundColor: kSurface2,
                  child: Icon(Icons.person, color: kInk),
                ),
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
              leading: const Icon(Icons.logout, color: kErrorDeep),
              title:
                  const Text('Chiqish', style: TextStyle(color: kErrorDeep)),
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
