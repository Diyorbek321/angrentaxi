import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

class TariffSelectScreen extends StatefulWidget {
  const TariffSelectScreen({super.key});

  @override
  State<TariffSelectScreen> createState() => _TariffSelectScreenState();
}

class _TariffSelectScreenState extends State<TariffSelectScreen> {
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
      Navigator.of(
        context,
      ).pushNamedAndRemoveUntil('/passenger/home', (_) => false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Tarif tanlash'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: Consumer<OrderProvider>(
        builder: (context, provider, _) {
          if (provider.state == OrderProviderState.loading &&
              provider.tariffs.isEmpty) {
            return const LoadingWidget(message: 'Tariflar yuklanmoqda...');
          }

          return Column(
            children: [
              _buildRouteCard(provider),
              const Divider(height: 1),
              Expanded(
                child: provider.tariffs.isEmpty
                    ? const Center(
                        child: Text(
                          'Tariflar mavjud emas',
                          style: TextStyle(color: kTextSecondary),
                        ),
                      )
                    : _buildTariffList(provider),
              ),
              _buildBottomBar(provider),
            ],
          );
        },
      ),
    );
  }

  Widget _buildRouteCard(OrderProvider provider) {
    final pickup = provider.pendingPickup;
    final dropoff = provider.pendingDropoff;

    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      child: Column(
        children: [
          _buildRouteRow(
            Icons.radio_button_checked,
            Colors.green,
            pickup?.address ?? 'Joylashuv...',
          ),
          const Padding(
            padding: EdgeInsets.only(left: 11),
            child: SizedBox(
              height: 20,
              child: VerticalDivider(
                width: 1,
                color: Colors.grey,
                thickness: 1,
              ),
            ),
          ),
          _buildRouteRow(
            Icons.location_on,
            kError,
            dropoff?.address ?? 'Manzil...',
          ),
        ],
      ),
    );
  }

  Widget _buildRouteRow(IconData icon, Color color, String text) {
    return Row(
      children: [
        Icon(icon, color: color, size: 22),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: const TextStyle(fontSize: 14),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildTariffList(OrderProvider provider) {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: provider.tariffs.length,
      itemBuilder: (context, index) {
        final tariff = provider.tariffs[index];
        final isSelected = provider.selectedTariff?.id == tariff.id;
        return _TariffCard(
          tariff: tariff,
          isSelected: isSelected,
          estimatedPrice: isSelected ? provider.estimatedPrice : null,
          onTap: () {
            provider.selectTariff(tariff);
            _estimateIfReady(provider);
          },
        )
            .animate()
            .fadeIn(delay: (index * 80).ms, duration: 400.ms)
            .slideX(begin: 0.15, curve: Curves.easeOutCubic);
      },
    );
  }

  Widget _buildBottomBar(OrderProvider provider) {
    final selectedTariff = provider.selectedTariff;
    final price = provider.estimatedPrice;

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      decoration: const BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: Colors.black12, blurRadius: 8, offset: Offset(0, -2)),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (provider.state == OrderProviderState.error &&
              provider.error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: InlineErrorWidget(message: provider.error!),
            ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Narxi:',
                    style: TextStyle(color: kTextSecondary, fontSize: 12),
                  ),
                  Text(
                    price != null
                        ? Formatters.formatPrice(price)
                        : selectedTariff != null
                        ? '~${Formatters.formatPrice(selectedTariff.minFare)}'
                        : '—',
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              SizedBox(
                width: 180,
                child: AppButton(
                  label: 'Buyurtma qilish',
                  onPressed:
                      selectedTariff != null || provider.tariffs.isNotEmpty
                          ? _onConfirmOrder
                          : null,
                  isLoading: provider.state == OrderProviderState.loading,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TariffCard extends StatelessWidget {
  const _TariffCard({
    required this.tariff,
    required this.isSelected,
    required this.onTap,
    this.estimatedPrice,
  });

  final Tariff tariff;
  final bool isSelected;
  final VoidCallback onTap;
  final double? estimatedPrice;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: tariff.isAvailable ? onTap : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? kPrimaryYellow.withAlpha(30) : Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? kPrimaryYellow : Colors.grey.shade200,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withAlpha(10),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: kSurfaceGrey,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.local_taxi, size: 32, color: kSecondaryBlack),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        tariff.name,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                        ),
                      ),
                      if (!tariff.isAvailable) ...[
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade200,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'Mavjud emas',
                            style: TextStyle(fontSize: 11, color: kTextSecondary),
                          ),
                        ),
                      ],
                    ],
                  ),
                  Text(
                    tariff.description,
                    style: const TextStyle(
                      color: kTextSecondary,
                      fontSize: 12,
                    ),
                  ),
                  Text(
                    'min ${Formatters.formatPrice(tariff.minFare)}',
                    style: const TextStyle(
                      color: kTextSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (estimatedPrice != null)
                  Text(
                    Formatters.formatPrice(estimatedPrice!),
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  )
                else
                  Text(
                    '${Formatters.formatPriceCompact(tariff.perKmRate)}/km',
                    style: const TextStyle(
                      color: kTextSecondary,
                      fontSize: 13,
                    ),
                  ),
                if (isSelected)
                  const Icon(Icons.check_circle, color: kPrimaryYellow, size: 20),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
