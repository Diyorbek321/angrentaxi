import 'dart:async';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/rate_passenger_screen.dart';
import 'package:angren_taxi/features/trip/screens/trip_chat_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class TripScreen extends StatefulWidget {
  const TripScreen({super.key, this.sosService});

  /// Injectable for tests — defaults to a [SosService] built from the real
  /// [ApiClient] in the service locator (same pattern as
  /// PassengerHomeScreen.sosService).
  final SosService? sosService;

  @override
  State<TripScreen> createState() => _TripScreenState();
}

class _TripScreenState extends State<TripScreen> {
  final MapController _mapController = MapController();
  LatLng _currentLocation = const LatLng(
    AppConfig.defaultLat,
    AppConfig.defaultLng,
  );
  int _tripSeconds = 0;
  Timer? _tripTimer;

  SosService get _sosService =>
      widget.sosService ?? SosService(apiClient: sl<ApiClient>());

  @override
  void initState() {
    super.initState();
    _initLocation();
    _startTripTimer();
  }

  @override
  void dispose() {
    _tripTimer?.cancel();
    super.dispose();
  }

  void _startTripTimer() {
    _tripTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() => _tripSeconds++);
    });
  }

  String get _tripTimeText {
    final mins = _tripSeconds ~/ 60;
    final secs = _tripSeconds % 60;
    return '${mins.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }

  Future<void> _initLocation() async {
    final locationService = sl<LocationService>();
    final position = await locationService.getCurrentPosition();
    if (position != null && mounted) {
      setState(() {
        _currentLocation = LatLng(position.latitude, position.longitude);
      });
      _mapController.move(_currentLocation, 15);
    }
  }

  Future<void> _onCompleteTrip(Order order) async {
    final confirmed = await _showCompletionDialog();
    if (!confirmed || !mounted) return;

    final provider = context.read<DriverProvider>();
    await provider.completeTrip();

    if (!mounted) return;
    if (provider.state == DriverProviderState.success) {
      _showSuccessAndNavigate(order);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(provider.error ?? 'Safarni yakunlab bo\'lmadi')),
      );
    }
  }

  Future<bool> _showCompletionDialog() async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Safarni yakunlash'),
            content: const Text('Safarni yakunlashni tasdiqlaysizmi?'),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(ctx).pop(false),
                child: const Text('Bekor qilish'),
              ),
              ElevatedButton(
                onPressed: () => Navigator.of(ctx).pop(true),
                child: const Text('Yakunlash'),
              ),
            ],
          ),
        ) ??
        false;
  }

  void _showSuccessAndNavigate(Order order) {
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRadiusLg),
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Yorug' fonda ma'noli yashil — kPrimary (mint 2.12:1).
            ExcludeSemantics(
              child: Icon(Icons.check_circle, color: kPrimary, size: 64),
            ),
            SizedBox(height: kSpace4),
            Text(
              'Safar muvaffaqiyatli yakunlandi!',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: kFontTitle,
                fontWeight: FontWeight.w800,
                color: kInk,
              ),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              // Land on /driver/home first (clearing the trip stack beneath
              // it), then push the rating screen on top — its own
              // submit/skip just calls Navigator.pop(), which then correctly
              // reveals home instead of stale navigation/arrived screens.
              Navigator.of(context).pushNamedAndRemoveUntil(
                '/driver/home',
                (route) => false,
              );
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => RatePassengerScreen(
                    orderId: order.id,
                    passengerPhone:
                        order.passengerName ?? order.passengerPhone ?? '',
                  ),
                ),
              );
            },
            child: const Text('Davom etish'),
          ),
        ],
      ),
    );
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

  // Emergency services number (Uzbekistan combined police/fire line). The
  // sheet also mentions 103 (ambulance) in its label, but tel: only accepts
  // a single number to dial. Mirrors PassengerHomeScreen._callEmergency.
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
    // Reuses the position DriverProvider is already streaming from
    // Geolocator (via goOnline's location subscription) instead of
    // requesting a fresh fix, falling back to the last position the map
    // centered on if the stream hasn't produced one yet.
    final lastKnown = context.read<DriverProvider>().lastKnownPosition;
    final lat = lastKnown?.latitude ?? _currentLocation.latitude;
    final lng = lastKnown?.longitude ?? _currentLocation.longitude;
    try {
      await _sosService.reportSos(orderId: orderId, lat: lat, lng: lng);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            // Oq snackbar matni mint fonda 2.12:1 edi — kPrimary 5.38:1.
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
            kSpace4,
            kSpace5,
            kSpace4,
            kSpace6,
          ),
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
                // kError + oq matn 3.91:1 (AA emas) → kErrorDeep 6.47:1.
                backgroundColor: kErrorDeep,
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
              _buildTopBar(order),
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
                  // Mint to'ldirish + ink ikona (7.84:1).
                  color: kMint,
                  shape: BoxShape.circle,
                  border: Border.all(color: kSurface, width: 3),
                  boxShadow: kShadowCard,
                ),
                child: const Icon(Icons.local_taxi, color: kOnMint, size: 24),
              ),
            ),
            Marker(
              point: LatLng(order.dropoff.lat, order.dropoff.lng),
              width: 44,
              height: 44,
              child: const Icon(Icons.flag, color: kError, size: 44),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildTopBar(Order order) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(kSpace4),
        child: Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: kSpace4,
                  vertical: kSpace3,
                ),
                decoration: BoxDecoration(
                  // Mint TO'LDIRISH — ustidagi matn/ikona kOnMint (7.84:1),
                  // hech qachon oq.
                  color: kMint,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: kShadowCard,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        ExcludeSemantics(
                          child: Icon(
                            Icons.local_taxi,
                            color: kOnMint,
                            size: 20,
                          ),
                        ),
                        SizedBox(width: kSpace1 + 2),
                        Text(
                          'Safar davom etmoqda',
                          style: TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: kFontBody,
                            color: kOnMint,
                          ),
                        ),
                      ],
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: kSpace3,
                        vertical: kSpace1,
                      ),
                      decoration: BoxDecoration(
                        color: kOnMint.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(kRadiusXs),
                      ),
                      child: Text(
                        _tripTimeText,
                        style: const TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: kFontBody,
                          color: kOnMint,
                          fontFeatures: [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: kSpace3),
            _buildSosButton(order),
          ],
        ),
      ),
    );
  }

  /// Small red circular SOS button next to the trip status bar. Opens
  /// [_showSosSheet] with emergency-call and dispatcher-alert options.
  /// Mirrors PassengerHomeScreen._buildSosButton for UI consistency.
  Widget _buildSosButton(Order order) {
    return Semantics(
      button: true,
      label: 'SOS — favqulodda yordam',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => _showSosSheet(order),
        child: Container(
          width: kMinTapTarget,
          height: kMinTapTarget,
          decoration: BoxDecoration(
            color: kError,
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: kError.withValues(alpha: 0.4),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: const Icon(Icons.sos_rounded, color: kOnPrimary, size: 22),
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
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace8),
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
            const SizedBox(height: kSpace4),
            _buildPassengerInfo(order),
            const SizedBox(height: kSpace4),
            _buildDestinationCard(order),
            const SizedBox(height: kSpace4),
            _buildPriceRow(order),
            const SizedBox(height: kSpace4),
            AppButton(
              label: 'Safarni yakunlash',
              onPressed: () => _onCompleteTrip(order),
              isLoading: provider.state == DriverProviderState.loading,
              // Oldin kSuccess (mint) + oq matn = 2.12:1 edi.
              icon: const Icon(Icons.check, color: kOnPrimary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPassengerInfo(Order order) {
    final passengerName = order.passengerName?.isNotEmpty == true
        ? order.passengerName!
        : "Yo'lovchi";
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          const ExcludeSemantics(
            child: CircleAvatar(
              radius: 20,
              backgroundColor: kSurface,
              child: Icon(Icons.person_rounded, color: kInkMuted),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  "Yo'lovchi",
                  style: TextStyle(color: kInkMuted, fontSize: kFontMicro),
                ),
                Text(
                  passengerName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: kFontBody,
                    color: kInk,
                  ),
                ),
              ],
            ),
          ),
          // Chat button — opens in-trip messaging with the passenger.
          Semantics(
            button: true,
            label: "Yo'lovchi bilan yozishish",
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => _openChat(order),
              child: Container(
                width: kMinTapTarget,
                height: kMinTapTarget,
                decoration: BoxDecoration(
                  color: kSurface,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  border: Border.all(color: kLineStrong),
                ),
                child: const Icon(
                  Icons.chat_bubble_outline_rounded,
                  color: kInk,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDestinationCard(Order order) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          const ExcludeSemantics(
            child: Icon(Icons.location_on, color: kError, size: 24),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Manzil',
                  style: TextStyle(color: kInkMuted, fontSize: kFontMicro),
                ),
                Text(
                  order.dropoff.address,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: kFontBody,
                    color: kInk,
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

  Widget _buildPriceRow(Order order) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        const Text(
          'Taxminiy daromad:',
          style: TextStyle(color: kInkMuted, fontSize: kFontBody),
        ),
        Text(
          Formatters.formatPrice(order.estimatedPrice),
          style: const TextStyle(
            fontWeight: FontWeight.w800,
            fontSize: kFontH2,
            // Oq fonda mint matn 2.12:1 edi → kPrimary 5.38:1.
            color: kPrimary,
          ),
        ),
      ],
    );
  }
}
