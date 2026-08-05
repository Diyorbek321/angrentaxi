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
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

/// Yandex Go-style tariff screen: route map on top, horizontal tariff cards
/// and a full-width primary order button in a bottom sheet.
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
      waypoints:
          provider.pendingWaypoints.map((w) => LatLng(w.lat, w.lng)).toList(),
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
                  padding: const EdgeInsets.all(kSpace4),
                  child: _CircleButton(
                    icon: Icons.arrow_back_rounded,
                    semanticsLabel: 'Orqaga',
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
        // ATAYLAB SAQLANADI: marshrut polilinesi minti — sof dekorativ
        // brend aksenti, ma'no matn orqali beriladi.
        PolylineLayer(
          polylines: [
            Polyline(points: routePoints, strokeWidth: 4, color: kMint),
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
                  border: Border.all(color: kSurface, width: 3),
                ),
              ),
            ),
            // Numbered intermediate stops, in visit order between pickup
            // ("1", implicit) and dropoff — matches the numbering shown in
            // destination_screen's waypoints list.
            for (final entry in provider.pendingWaypoints.asMap().entries)
              Marker(
                point: LatLng(entry.value.lat, entry.value.lng),
                width: 22,
                height: 22,
                child: Container(
                  decoration: BoxDecoration(
                    color: kInk,
                    shape: BoxShape.circle,
                    border: Border.all(color: kSurface, width: 2),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    '${entry.key + 2}',
                    style: const TextStyle(
                      color: kOnPrimary,
                      fontSize: kFontMicro,
                      fontWeight: FontWeight.w800,
                    ),
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
    // Ro'yxat yuklanayotganda spinner emas, skeleton — kontent kelganda
    // panel sakramaydi.
    if (provider.state == OrderProviderState.loading &&
        provider.tariffs.isEmpty) {
      return Container(
        height: 220,
        padding: const EdgeInsets.only(top: kSpace5),
        decoration: const BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
        ),
        child: const AppSkeletonList(itemCount: 2, lines: 2, hasTrailing: true),
      );
    }

    final selected = provider.selectedTariff ??
        (provider.tariffs.isNotEmpty ? provider.tariffs.first : null);
    final price = provider.estimatedPrice;
    final canOrder = selected != null &&
        provider.state != OrderProviderState.loading &&
        !_payingByCard;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, kSpace8),
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
          const SizedBox(height: kSpace4),
          _buildRouteRow(provider),
          const SizedBox(height: kSpace4),
          // Horizontal tariff cards (Yandex signature). Tall enough to fit
          // the extra "Talab yuqori" surge label on surged tariffs without
          // overflowing.
          SizedBox(
            // Bo'sh holat (ikonka + sarlavha) kartalardan bir oz balandroq.
            height: provider.tariffs.isEmpty ? 152 : 138,
            child: provider.tariffs.isEmpty
                ? const AppEmptyState(
                    icon: Icons.local_taxi_outlined,
                    title: 'Tariflar mavjud emas',
                    compact: true,
                  )
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: provider.tariffs.length,
                    separatorBuilder: (_, __) => const SizedBox(width: kSpace3),
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
          const SizedBox(height: kSpace4),
          _buildPaymentRow(),
          const SizedBox(height: kSpace4),
          if (provider.state == OrderProviderState.error &&
              provider.error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: kSpace3),
              child: InlineErrorWidget(message: provider.error!),
            ),
          // Asosiy CTA — to'q yashil gradient, ustida OQ matn (5.38:1).
          Semantics(
            button: true,
            enabled: canOrder,
            child: GestureDetector(
              onTap: canOrder ? _onConfirmOrder : null,
              behavior: HitTestBehavior.opaque,
              child: Container(
                width: double.infinity,
                height: kControlHeight,
                decoration: BoxDecoration(
                  gradient: kGradientCta,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  boxShadow: kShadowCta,
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
                              AlwaysStoppedAnimation<Color>(kOnPrimary),
                        ),
                      )
                    : Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Text(
                            'Buyurtma',
                            style: TextStyle(
                              fontSize: kFontH3,
                              fontWeight: FontWeight.w800,
                              color: kOnPrimary,
                            ),
                          ),
                          if (price != null) ...[
                            const SizedBox(width: kSpace2),
                            ExcludeSemantics(
                              child: Container(
                                width: 5,
                                height: 5,
                                decoration: BoxDecoration(
                                  color: kOnPrimary.withValues(alpha: 0.7),
                                  shape: BoxShape.circle,
                                ),
                              ),
                            ),
                            const SizedBox(width: kSpace2),
                            Text(
                              Formatters.formatPrice(price),
                              style: const TextStyle(
                                fontSize: kFontH3,
                                fontWeight: FontWeight.w800,
                                color: kOnPrimary,
                              ),
                            ),
                          ],
                        ],
                      ),
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
      padding:
          const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace3),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          // ATAYLAB SAQLANADI: boshlanish nuqtasi minti — dekorativ.
          ExcludeSemantics(
            child: Column(
              children: [
                Container(
                  width: 10,
                  height: 10,
                  decoration: const BoxDecoration(
                    color: kMint,
                    shape: BoxShape.circle,
                  ),
                ),
                Container(width: 2, height: kSpace4, color: kLineStrong),
                const Icon(Icons.location_on, color: kInk, size: 14),
              ],
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(pickup,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w600,
                      color: kInk,
                    )),
                const SizedBox(height: kSpace2),
                Text(dropoff,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w600,
                      color: kInk,
                    )),
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
        const SizedBox(width: kSpace3),
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
    return Semantics(
      button: true,
      selected: isSelected,
      enabled: tariff.isAvailable,
      child: GestureDetector(
        onTap: tariff.isAvailable ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: 112,
          padding: const EdgeInsets.all(kSpace3),
          decoration: BoxDecoration(
            color: isSelected ? kMintTint : kSurface2,
            borderRadius: BorderRadius.circular(kRadiusMd),
            border: Border.all(
              color: isSelected ? kPrimary : Colors.transparent,
              width: 2,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // kMintTint yuza ustidagi ikona/matn — kPrimary.
                  ExcludeSemantics(
                    child: Icon(Icons.local_taxi_rounded,
                        size: 26, color: isSelected ? kPrimary : kInk),
                  ),
                  // Surge badge MA'NO tashiydi (narx oshgani) — u hech qachon
                  // qirqilmasligi kerak, shuning uchun ikona kichikroq.
                  if (tariff.surgeMultiplier > 1.0)
                    Flexible(child: _SurgeBadge(tariff.surgeMultiplier)),
                ],
              ),
              const Spacer(),
              Text(
                tariff.name,
                style: const TextStyle(
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w700,
                  color: kInk,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                price != null
                    ? Formatters.formatPrice(price!)
                    : '~${Formatters.formatPrice(tariff.minFare)}',
                style: TextStyle(
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w800,
                  color: isSelected ? kPrimary : kInk,
                ),
              ),
              if (tariff.surgeMultiplier > 1.0) ...[
                const SizedBox(height: 2),
                const Text(
                  'Talab yuqori',
                  style: TextStyle(
                    fontSize: kFontMicro,
                    fontWeight: FontWeight.w700,
                    // Yorug' fondagi amber MATN — kWarningDeep (5.02:1).
                    color: kWarningDeep,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Small amber chip shown on a tariff card when demand-surge pricing is
/// active (backend's `surgeMultiplier` on GET /tariffs is > 1.0), e.g. "x1.5".
class _SurgeBadge extends StatelessWidget {
  const _SurgeBadge(this.surgeMultiplier);

  final double surgeMultiplier;

  @override
  Widget build(BuildContext context) {
    final label = surgeMultiplier == surgeMultiplier.roundToDouble()
        ? 'x${surgeMultiplier.toStringAsFixed(0)}'
        : 'x${surgeMultiplier.toStringAsFixed(1)}';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: kWarningLight,
        borderRadius: BorderRadius.circular(kRadiusXs),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: kFontMicro,
          fontWeight: FontWeight.w800,
          color: kWarningDeep,
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
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinTapTarget,
            minWidth: kMinTapTarget,
          ),
          child: Container(
            padding: const EdgeInsets.symmetric(
                horizontal: kSpace4, vertical: kSpace3),
            decoration: BoxDecoration(
              color: selected ? kMintTint : kSurface2,
              borderRadius: BorderRadius.circular(kRadiusSm),
              border: Border.all(
                color: selected ? kPrimary : Colors.transparent,
                width: 1.5,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: selected ? kPrimary : kInkMuted),
                const SizedBox(width: kSpace2),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w600,
                    color: selected ? kPrimary : kInk,
                  ),
                ),
              ],
            ),
          ),
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
      padding:
          const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace2),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusFull),
        boxShadow: kShadowPop,
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox(
            width: 14,
            height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary),
          ),
          SizedBox(width: kSpace2),
          Text(
            "Yo'nalish yuklanmoqda...",
            style: TextStyle(
              fontSize: kFontCaption,
              fontWeight: FontWeight.w600,
              color: kInk,
            ),
          ),
        ],
      ),
    );
  }
}

/// Xarita ustidagi dumaloq ikona-tugma — 48x48 tegish maydoni va matnli
/// yorliq bilan.
class _CircleButton extends StatelessWidget {
  const _CircleButton({
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
  });

  final IconData icon;
  final VoidCallback onTap;
  final String semanticsLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minHeight: kMinTapTarget,
            minWidth: kMinTapTarget,
          ),
          child: Container(
            width: kMinTapTarget,
            height: kMinTapTarget,
            decoration: BoxDecoration(
              color: kSurface,
              shape: BoxShape.circle,
              boxShadow: kShadowPop,
            ),
            child: Icon(icon, color: kInk),
          ),
        ),
      ),
    );
  }
}
