import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

/// Yandex Go-style tariff screen: route map on top, horizontal tariff cards
/// and a full-width mint order button in a bottom sheet.
class TariffSelectScreen extends StatefulWidget {
  const TariffSelectScreen({super.key});

  @override
  State<TariffSelectScreen> createState() => _TariffSelectScreenState();
}

class _TariffSelectScreenState extends State<TariffSelectScreen> {
  String _paymentMethod = 'cash';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<OrderProvider>();
      provider.loadTariffs();
      _estimateIfReady(provider);
    });
  }

  void _estimateIfReady(OrderProvider provider) {
    final pickup = provider.pendingPickup;
    final dropoff = provider.pendingDropoff;
    if (pickup == null || dropoff == null) return;
    if (provider.tariffs.isNotEmpty) {
      final tariff = provider.selectedTariff ?? provider.tariffs.first;
      provider.estimatePrice(
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffLat: dropoff.lat,
        dropoffLng: dropoff.lng,
        tariffId: tariff.id,
      );
    }
  }

  Future<void> _onConfirmOrder() async {
    final provider = context.read<OrderProvider>();
    if (provider.selectedTariff == null && provider.tariffs.isNotEmpty) {
      provider.selectTariff(provider.tariffs.first);
    }
    final success = await provider.createOrder();
    if (!mounted) return;
    if (success) {
      Navigator.of(context)
          .pushNamedAndRemoveUntil('/passenger/home', (_) => false);
    }
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

    return FlutterMap(
      options: MapOptions(initialCenter: center, initialZoom: 13.5),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'uz.angren.taxi',
        ),
        PolylineLayer(
          polylines: [
            Polyline(points: [p, d], strokeWidth: 4, color: kPrimary),
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
                    provider.state != OrderProviderState.loading)
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
              child: provider.state == OrderProviderState.loading
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
