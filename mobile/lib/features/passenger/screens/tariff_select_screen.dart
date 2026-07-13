import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/payments/payment_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/payments/screens/payment_webview_screen.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

/// Yandex Go-style tariff screen: route map on top, horizontal tariff cards
/// and a full-width mint order button in a bottom sheet.
class TariffSelectScreen extends StatefulWidget {
  const TariffSelectScreen({
    super.key,
    this.paymentService,
    this.openPaymentCheckout,
  });

  /// Injectable for tests — defaults to a [PaymentService] built from the
  /// real [ApiClient] in the service locator.
  final PaymentService? paymentService;

  /// Injectable for tests — defaults to pushing [PaymentWebViewScreen].
  final OpenPaymentCheckout? openPaymentCheckout;

  @override
  State<TariffSelectScreen> createState() => _TariffSelectScreenState();
}

class _TariffSelectScreenState extends State<TariffSelectScreen> {
  String _paymentMethod = 'cash';
  bool _payingByCard = false;
  final MapController _mapController = MapController();
  bool _routeLoading = false;

  PaymentService get _paymentService =>
      widget.paymentService ?? PaymentService(apiClient: sl<ApiClient>());

  RouteService get _routeService => sl<RouteService>();

  Future<bool?> _openPaymentCheckout(
    BuildContext context,
    PaymentInitiateResult result,
  ) {
    if (widget.openPaymentCheckout != null) {
      return widget.openPaymentCheckout!(context, result);
    }
    return Navigator.of(context).push<bool>(
      MaterialPageRoute<bool>(
        builder: (_) => PaymentWebViewScreen(result: result),
      ),
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<OrderProvider>();
      provider.loadTariffs();
      _loadRoute(provider);
    });
  }

  /// Fetches the real driving route (for the map line) and, from its
  /// distance/duration, the price estimate — the backend has no routing
  /// engine of its own, so distanceKm/durationMin must come from the client.
  Future<void> _loadRoute(OrderProvider provider) async {
    final pickup = provider.pendingPickup;
    final dropoff = provider.pendingDropoff;
    if (pickup == null || dropoff == null) return;

    setState(() => _routeLoading = true);
    final route = await _routeService.getRoute(
      LatLng(pickup.lat, pickup.lng),
      LatLng(dropoff.lat, dropoff.lng),
    );
    if (!mounted) return;
    setState(() => _routeLoading = false);

    if (route != null) {
      provider.setRoute(
        points: route.points,
        distanceKm: route.distanceKm,
        durationMin: route.durationMin,
      );
      _fitRouteBounds(route.points);
    }

    _estimateIfReady(provider);
  }

  void _fitRouteBounds(List<LatLng> points) {
    if (points.isEmpty) return;
    try {
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(points),
          padding: const EdgeInsets.fromLTRB(48, 96, 48, 260),
        ),
      );
    } catch (_) {
      // Map not laid out yet (e.g. first frame) — the initial center/zoom
      // in MapOptions still shows a reasonable view.
    }
  }

  void _estimateIfReady(OrderProvider provider) {
    final pickup = provider.pendingPickup;
    final dropoff = provider.pendingDropoff;
    if (pickup == null || dropoff == null) return;
    if (provider.tariffs.isEmpty) return;

    final tariff = provider.selectedTariff ?? provider.tariffs.first;
    // Straight-line Haversine fallback if OSRM didn't return a route, so
    // price estimation still works (less accurate than the real route, but
    // better than not estimating at all).
    final distanceKm = provider.routeDistanceKm ??
        (const Distance().as(LengthUnit.Kilometer,
            LatLng(pickup.lat, pickup.lng), LatLng(dropoff.lat, dropoff.lng)));
    final durationMin = provider.routeDurationMin ?? (distanceKm / 30 * 60);

    provider.estimatePrice(
      distanceKm: distanceKm,
      durationMin: durationMin,
      tariffId: tariff.id,
    );
  }

  Future<void> _onConfirmOrder() async {
    final provider = context.read<OrderProvider>();
    if (provider.selectedTariff == null && provider.tariffs.isNotEmpty) {
      provider.selectTariff(provider.tariffs.first);
    }
    final success = await provider.createOrder();
    if (!mounted) return;
    if (!success) return;

    // Order placed. If the passenger chose card, try the real online
    // checkout for it.
    //
    // NOTE — real backend business rule: `POST /payments/initiate`
    // (backend/src/modules/payments/payments.service.ts) only accepts an
    // order once its status is COMPLETED — i.e. after the ride has actually
    // happened, not at order-creation time. A brand-new order (status
    // 'created'/'searching') will be rejected with
    // `400 Order must be completed before payment`. That's expected here,
    // not a client bug: card rides are still fully bookable, the actual
    // charge for them just has to happen post-trip (e.g. from the trip
    // summary once the driver marks it complete) rather than right after
    // tapping "Buyurtma". We still surface the call/response below so the
    // wiring is real and ready to use the moment an order does qualify —
    // and so passengers get a clear message instead of silent failure if a
    // charge attempt is made too early.
    if (_paymentMethod == 'card' && provider.activeOrder != null) {
      setState(() => _payingByCard = true);
      try {
        final result = await _paymentService.initiate(
          orderId: provider.activeOrder!.id,
        );
        if (!mounted) return;
        await _openPaymentCheckout(context, result);
      } on PaymentException catch (e) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              "To'lovni hozir boshlab bo'lmadi: ${e.message}. "
              "Buyurtma qabul qilindi, safar oxirida to'lov amalga oshiriladi.",
            ),
          ),
        );
      } finally {
        if (mounted) setState(() => _payingByCard = false);
      }
    }

    if (!mounted) return;
    Navigator.of(context)
        .pushNamedAndRemoveUntil('/passenger/home', (_) => false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: Consumer<OrderProvider>(
        builder: (context, provider, _) {
          return Stack(
            children: [
              _buildRouteMap(provider),
              // Floating back button
              SafeArea(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: _CircleButton(
                    icon: Icons.arrow_back_rounded,
                    onTap: () => Navigator.of(context).pop(),
                  ),
                ),
              ),
              if (_routeLoading)
                const Positioned(
                  top: 76,
                  left: 0,
                  right: 0,
                  child: Center(child: _RouteLoadingPill()),
                ),
              // Bottom sheet
              Align(
                alignment: Alignment.bottomCenter,
                child: _buildBottomPanel(provider),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildRouteMap(OrderProvider provider) {
    final pickup = provider.pendingPickup;
    final dropoff = provider.pendingDropoff;
    final p = pickup != null
        ? LatLng(pickup.lat, pickup.lng)
        : const LatLng(40.0956, 70.9432);
    final d = dropoff != null
        ? LatLng(dropoff.lat, dropoff.lng)
        : const LatLng(40.1050, 70.9500);
    final center = LatLng((p.latitude + d.latitude) / 2,
        (p.longitude + d.longitude) / 2);

    // Real road route from OSRM when available; a straight line is only a
    // fallback for when the route fetch fails (offline, OSRM unreachable).
    final routePoints =
        provider.routePoints.isNotEmpty ? provider.routePoints : [p, d];

    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(initialCenter: center, initialZoom: 13.5),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'uz.angren.taxi',
        ),
        PolylineLayer(
          polylines: [
            Polyline(points: routePoints, strokeWidth: 4, color: kPrimary),
          ],
        ),
        MarkerLayer(
          markers: [
            Marker(
              point: p,
              width: 26,
              height: 26,
              child: Container(
                decoration: BoxDecoration(
                  color: kPrimary,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                ),
              ),
            ),
            Marker(
              point: d,
              width: 34,
              height: 34,
              child: const Icon(Icons.location_on, color: kInk, size: 34),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBottomPanel(OrderProvider provider) {
    if (provider.state == OrderProviderState.loading &&
        provider.tariffs.isEmpty) {
      return Container(
        height: 220,
        decoration: const BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: const LoadingWidget(message: 'Tariflar yuklanmoqda...'),
      );
    }

    final selected = provider.selectedTariff ??
        (provider.tariffs.isNotEmpty ? provider.tariffs.first : null);
    final price = provider.estimatedPrice;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
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
          const SizedBox(height: 16),
          _buildRouteRow(provider),
          const SizedBox(height: 16),
          // Horizontal tariff cards (Yandex signature)
          SizedBox(
            height: 124,
            child: provider.tariffs.isEmpty
                ? const Center(
                    child: Text('Tariflar mavjud emas',
                        style: TextStyle(color: kTextSecondary)),
                  )
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: provider.tariffs.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 10),
                    itemBuilder: (context, i) {
                      final t = provider.tariffs[i];
                      final isSel = selected?.id == t.id;
                      return _TariffCardH(
                        tariff: t,
                        isSelected: isSel,
                        price: isSel ? price : null,
                        onTap: () {
                          provider.selectTariff(t);
                          _estimateIfReady(provider);
                        },
                      )
                          .animate()
                          .fadeIn(delay: (i * 70).ms, duration: 350.ms)
                          .slideX(begin: 0.2, curve: Curves.easeOut);
                    },
                  ),
          ),
          const SizedBox(height: 14),
          _buildPaymentRow(),
          const SizedBox(height: 14),
          if (provider.state == OrderProviderState.error &&
              provider.error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InlineErrorWidget(message: provider.error!),
            ),
          // Order button (mint, full width)
          GestureDetector(
            onTap: (selected != null &&
                    provider.state != OrderProviderState.loading &&
                    !_payingByCard)
                ? _onConfirmOrder
                : null,
            child: Container(
              width: double.infinity,
              height: 58,
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [kPrimary, kPrimaryDark]),
                borderRadius: BorderRadius.circular(kRadiusMd),
                boxShadow: [
                  BoxShadow(
                    color: kPrimary.withValues(alpha: 0.4),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: provider.state == OrderProviderState.loading ||
                      _payingByCard
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor:
                            AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Text(
                          'Buyurtma',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        if (price != null) ...[
                          const SizedBox(width: 8),
                          Container(
                            width: 5,
                            height: 5,
                            decoration: const BoxDecoration(
                              color: Colors.white70,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            Formatters.formatPrice(price),
                            style: const TextStyle(
                              fontSize: 17,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRouteRow(OrderProvider provider) {
    final pickup = provider.pendingPickup?.address ?? 'Joylashuv';
    final dropoff = provider.pendingDropoff?.address ?? 'Manzil';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          Column(
            children: [
              Container(
                width: 10,
                height: 10,
                decoration: const BoxDecoration(
                    color: kPrimary, shape: BoxShape.circle),
              ),
              Container(width: 2, height: 16, color: kTextSecondary),
              const Icon(Icons.location_on, color: kInk, size: 14),
            ],
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(pickup,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                Text(dropoff,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 13, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentRow() {
    return Row(
      children: [
        _PaymentChip(
          icon: Icons.payments_rounded,
          label: 'Naqd',
          selected: _paymentMethod == 'cash',
          onTap: () => setState(() => _paymentMethod = 'cash'),
        ),
        const SizedBox(width: 10),
        _PaymentChip(
          icon: Icons.credit_card_rounded,
          label: 'Karta',
          selected: _paymentMethod == 'card',
          onTap: () => setState(() => _paymentMethod = 'card'),
        ),
      ],
    );
  }
}

class _TariffCardH extends StatelessWidget {
  const _TariffCardH({
    required this.tariff,
    required this.isSelected,
    required this.onTap,
    this.price,
  });

  final Tariff tariff;
  final bool isSelected;
  final VoidCallback onTap;
  final double? price;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: tariff.isAvailable ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 112,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? kPrimaryLight : kSurfaceGrey,
          borderRadius: BorderRadius.circular(kRadiusMd),
          border: Border.all(
            color: isSelected ? kPrimary : Colors.transparent,
            width: 2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(Icons.local_taxi_rounded,
                size: 30, color: isSelected ? kPrimaryDark : kInk),
            const Spacer(),
            Text(
              tariff.name,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w700),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 2),
            Text(
              price != null
                  ? Formatters.formatPrice(price!)
                  : '~${Formatters.formatPrice(tariff.minFare)}',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: isSelected ? kPrimaryDark : kTextPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PaymentChip extends StatelessWidget {
  const _PaymentChip({
    required this.icon,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: selected ? kPrimaryLight : kSurfaceGrey,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: selected ? kPrimary : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: selected ? kPrimaryDark : kTextSecondary),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: selected ? kPrimaryDark : kTextPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RouteLoadingPill extends StatelessWidget {
  const _RouteLoadingPill();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: kInk.withValues(alpha: 0.12), blurRadius: 12),
        ],
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
          ),
          SizedBox(width: 8),
          Text(
            "Yo'nalish yuklanmoqda...",
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _CircleButton extends StatelessWidget {
  const _CircleButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 46,
        height: 46,
        decoration: BoxDecoration(
          color: kSurface,
          shape: BoxShape.circle,
          boxShadow: [
            BoxShadow(color: kInk.withValues(alpha: 0.12), blurRadius: 12),
          ],
        ),
        child: Icon(icon, color: kInk),
      ),
    );
  }
}
