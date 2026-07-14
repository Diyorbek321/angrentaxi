import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';

class NavigationScreen extends StatefulWidget {
  const NavigationScreen({super.key});

  @override
  State<NavigationScreen> createState() => _NavigationScreenState();
}

class _NavigationScreenState extends State<NavigationScreen> {
  final MapController _mapController = MapController();
  LatLng _currentLocation = LatLng(
    AppConfig.defaultLat,
    AppConfig.defaultLng,
  );
  double? _distanceToPickup;

  @override
  void initState() {
    super.initState();
    _initLocation();
  }

  Future<void> _initLocation() async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (position != null && mounted) {
      setState(() {
        _currentLocation = LatLng(position.latitude, position.longitude);
      });

      final order = context.read<DriverProvider>().activeOrder;
      if (order != null) {
        final dist = locationService.calculateDistance(
          position.latitude,
          position.longitude,
          order.pickup.lat,
          order.pickup.lng,
        );
        if (mounted) setState(() => _distanceToPickup = dist);
      }

      _mapController.move(_currentLocation, 15);
    }
  }

  Future<void> _onArrived() async {
    final provider = context.read<DriverProvider>();
    await provider.arrivedAtPickup();
    if (!mounted) return;
    if (provider.state == DriverProviderState.success) {
      Navigator.of(context).pushReplacementNamed('/driver/arrived');
    }
  }

  /// This screen only shows before the passenger is picked up (see
  /// app.dart / home_screen.dart#_navigateToActiveOrder — driverAssigned and
  /// driverEnRoute route here, driverArrived/inProgress route to the
  /// arrived/trip screens instead). It still checks the order's status
  /// defensively so navigation always points at whichever leg is actually
  /// next if that assumption ever changes.
  OrderLocation _nextDestination(Order order) {
    return order.status == OrderStatus.inProgress
        ? order.dropoff
        : order.pickup;
  }

  /// Opens the device's default navigation app with turn-by-turn directions
  /// to [destination]. Uses a generic `geo:` URI on Android/others, which the
  /// OS resolves to whichever maps app is installed (Google Maps, Yandex
  /// Maps, etc.), prompting a chooser if more than one handles it. `geo:` is
  /// not supported on iOS, so Apple Maps' web deep link is used there
  /// instead — Google Maps also handles that same URL as a fallback if it's
  /// installed. Follows the same canLaunchUrl/launchUrl guard-and-snackbar
  /// pattern as _callDriver in
  /// lib/features/passenger/screens/home_screen.dart.
  Future<void> _openNavigation(OrderLocation destination) async {
    final label = Uri.encodeComponent(destination.address);
    final uri = Platform.isIOS
        ? Uri.parse(
            'https://maps.apple.com/?daddr=${destination.lat},${destination.lng}',
          )
        : Uri.parse(
            'geo:0,0?q=${destination.lat},${destination.lng}($label)',
          );
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Navigatsiya ilovasi topilmadi')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          final order = provider.activeOrder;
          if (order == null) {
            return const Center(child: CircularProgressIndicator());
          }

          return Stack(
            children: [
              _buildMap(order),
              _buildTopBar(),
              _buildBottomCard(order, provider),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMap(Order order) {
    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: _currentLocation,
        initialZoom: 15,
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
                  color: kPrimaryYellow,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: const [
                    BoxShadow(color: Colors.black26, blurRadius: 6),
                  ],
                ),
                child: const Icon(Icons.local_taxi, color: Colors.black, size: 24),
              ),
            ),
            Marker(
              point: LatLng(order.pickup.lat, order.pickup.lng),
              width: 44,
              height: 44,
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.green.shade600,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: const Icon(Icons.person, color: Colors.white, size: 22),
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
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                boxShadow: const [
                  BoxShadow(color: Colors.black12, blurRadius: 6),
                ],
              ),
              child: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: const [
                    BoxShadow(color: Colors.black12, blurRadius: 6),
                  ],
                ),
                child: const Row(
                  children: [
                    Icon(Icons.navigation, color: kPrimaryYellow, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Yo\'lovchiga yo\'l',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomCard(Order order, DriverProvider provider) {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
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
            const SizedBox(height: 16),
            _buildPickupInfo(order),
            const SizedBox(height: 16),
            if (_distanceToPickup != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    const Icon(
                      Icons.directions_car,
                      color: kTextSecondary,
                      size: 18,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Yo\'lovchigacha: ${Formatters.formatDistance(_distanceToPickup!)}',
                      style: const TextStyle(
                        color: kTextSecondary,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
            AppOutlinedButton(
              label: 'Navigatsiyani ochish',
              onPressed: () => _openNavigation(_nextDestination(order)),
              borderColor: kPrimaryYellow,
              textColor: kInk,
              icon: const Icon(Icons.navigation, color: kInk),
            ),
            const SizedBox(height: 12),
            AppButton(
              label: 'Yetib keldim',
              onPressed: _onArrived,
              isLoading: provider.state == DriverProviderState.loading,
              backgroundColor: kSuccess,
              foregroundColor: Colors.white,
              icon: const Icon(Icons.check, color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPickupInfo(Order order) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: Colors.green.shade100,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.radio_button_checked,
              color: Colors.green,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Olish manzili',
                  style: TextStyle(
                    color: kTextSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(
                  order.pickup.address,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                  maxLines: 2,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
