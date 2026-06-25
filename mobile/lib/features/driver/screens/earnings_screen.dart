import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

class EarningsScreen extends StatefulWidget {
  const EarningsScreen({super.key});

  @override
  State<EarningsScreen> createState() => _EarningsScreenState();
}

class _EarningsScreenState extends State<EarningsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final provider = context.read<DriverProvider>();
      provider.loadEarnings();
      provider.loadOrderHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Daromad')),
      body: Consumer<DriverProvider>(
        builder: (context, provider, _) {
          if (provider.state == DriverProviderState.loading &&
              provider.orderHistory.isEmpty) {
            return const LoadingWidget(message: 'Yuklanmoqda...');
          }

          if (provider.state == DriverProviderState.error &&
              provider.orderHistory.isEmpty) {
            return AppErrorWidget(
              message: provider.error ?? 'Xatolik yuz berdi',
              onRetry: () {
                provider.loadEarnings();
                provider.loadOrderHistory();
              },
            );
          }

          return RefreshIndicator(
            onRefresh: () async {
              await provider.loadEarnings();
              await provider.loadOrderHistory();
            },
            color: kPrimaryYellow,
            child: CustomScrollView(
              slivers: [
                SliverToBoxAdapter(
                  child: _buildEarningsSummary(provider),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                    child: Text(
                      'Buyurtmalar tarixi',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.grey.shade800,
                      ),
                    ),
                  ),
                ),
                if (provider.orderHistory.isEmpty)
                  const SliverFillRemaining(
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.history,
                            size: 64,
                            color: kTextSecondary,
                          ),
                          SizedBox(height: 12),
                          Text(
                            'Buyurtmalar tarixi yo\'q',
                            style: TextStyle(color: kTextSecondary),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => _DriverOrderCard(
                        order: provider.orderHistory[index],
                      ),
                      childCount: provider.orderHistory.length,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildEarningsSummary(DriverProvider provider) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [kSecondaryBlack, Color(0xFF2D2D2D)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Bugungi daromad',
            style: TextStyle(color: Colors.white60, fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            Formatters.formatPrice(provider.todayEarnings),
            style: const TextStyle(
              color: kPrimaryYellow,
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _EarningsStatChip(
                label: "Jami buyurtmalar",
                value: provider.orderHistory.length.toString(),
              ),
              const SizedBox(width: 12),
              _EarningsStatChip(
                label: 'Yakunlangan',
                value: provider.orderHistory
                    .where((o) => o.status == OrderStatus.completed)
                    .length
                    .toString(),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EarningsStatChip extends StatelessWidget {
  const _EarningsStatChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white.withAlpha(20),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
            Text(
              label,
              style: const TextStyle(color: Colors.white60, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }
}

class _DriverOrderCard extends StatelessWidget {
  const _DriverOrderCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade100),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(8),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: order.status == OrderStatus.completed
                  ? kSuccess.withAlpha(20)
                  : kError.withAlpha(20),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              order.status == OrderStatus.completed
                  ? Icons.check_circle_outline
                  : Icons.cancel_outlined,
              color: order.status == OrderStatus.completed ? kSuccess : kError,
              size: 22,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  order.dropoff.address,
                  style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  Formatters.formatRelativeDate(order.createdAt),
                  style: const TextStyle(color: kTextSecondary, fontSize: 11),
                ),
              ],
            ),
          ),
          if (order.status == OrderStatus.completed)
            Text(
              Formatters.formatPrice(order.actualPrice ?? order.estimatedPrice),
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 14,
                color: kSuccess,
              ),
            ),
        ],
      ),
    );
  }
}
