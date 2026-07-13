import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:angren_taxi/shared/widgets/loading_widget.dart';

class OrderHistoryScreen extends StatefulWidget {
  const OrderHistoryScreen({super.key});

  @override
  State<OrderHistoryScreen> createState() => _OrderHistoryScreenState();
}

class _OrderHistoryScreenState extends State<OrderHistoryScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<OrderProvider>().loadOrderHistory();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Sayohat tarixi')),
      body: Consumer<OrderProvider>(
        builder: (context, provider, _) {
          if (provider.state == OrderProviderState.loading &&
              provider.orderHistory.isEmpty) {
            return const LoadingWidget(message: 'Yuklanmoqda...');
          }

          if (provider.state == OrderProviderState.error) {
            return AppErrorWidget(
              message: provider.error ?? 'Xatolik yuz berdi',
              onRetry: provider.loadOrderHistory,
            );
          }

          if (provider.orderHistory.isEmpty) {
            return const Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.history, size: 64, color: kTextSecondary),
                  SizedBox(height: 16),
                  Text(
                    'Sayohat tarixi yo\'q',
                    style: TextStyle(fontSize: 16, color: kTextSecondary),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: provider.loadOrderHistory,
            color: kPrimaryYellow,
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: provider.orderHistory.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, index) {
                return _OrderHistoryCard(order: provider.orderHistory[index]);
              },
            ),
          );
        },
      ),
    );
  }
}

class _OrderHistoryCard extends StatelessWidget {
  const _OrderHistoryCard({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () => _showOrderDetails(context),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    Formatters.formatRelativeDate(order.createdAt),
                    style: const TextStyle(
                      color: kTextSecondary,
                      fontSize: 12,
                    ),
                  ),
                  _buildStatusBadge(order.status),
                ],
              ),
              const SizedBox(height: 12),
              _buildRouteInfo(),
              const Divider(height: 20),
              Row(
                children: [
                  if (order.driver != null) ...[
                    const Icon(Icons.person_outline, size: 16, color: kTextSecondary),
                    const SizedBox(width: 4),
                    Text(
                      order.driver!.name,
                      style: const TextStyle(
                        fontSize: 13,
                        color: kTextSecondary,
                      ),
                    ),
                    const Spacer(),
                  ],
                  Text(
                    Formatters.formatPrice(
                      order.actualPrice ?? order.estimatedPrice,
                    ),
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
              if (order.status == OrderStatus.completed) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => _repeatOrder(context),
                    icon: const Icon(Icons.replay, size: 18),
                    label: const Text('Safarni takrorlash'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  void _repeatOrder(BuildContext context) {
    context.read<OrderProvider>().setPendingPickup(order.pickup);
    context.read<OrderProvider>().setPendingDropoff(order.dropoff);
    Navigator.of(context).pushNamed('/passenger/tariff');
  }

  Widget _buildStatusBadge(OrderStatus status) {
    Color color;
    switch (status) {
      case OrderStatus.completed:
        color = kSuccess;
      case OrderStatus.cancelled:
        color = kError;
      default:
        color = kTextSecondary;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(80)),
      ),
      child: Text(
        status.label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _buildRouteInfo() {
    return Column(
      children: [
        Row(
          children: [
            const Icon(Icons.radio_button_checked, color: Colors.green, size: 16),
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
            const Icon(Icons.location_on, color: kError, size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                order.dropoff.address,
                style: const TextStyle(fontSize: 13),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ],
    );
  }

  void _showOrderDetails(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (ctx, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.grey.shade300,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Buyurtma tafsilotlari',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 16),
              _buildDetailRow('Sana', Formatters.formatDateTime(order.createdAt)),
              _buildDetailRow('Holat', order.status.label),
              _buildDetailRow('Chiqish', order.pickup.address),
              _buildDetailRow('Manzil', order.dropoff.address),
              if (order.driver != null)
                _buildDetailRow('Haydovchi', order.driver!.name),
              if (order.driver != null)
                _buildDetailRow('Mashina', order.driver!.carInfo),
              _buildDetailRow(
                'Narx',
                Formatters.formatPrice(order.actualPrice ?? order.estimatedPrice),
              ),
              if (order.distanceKm != null)
                _buildDetailRow(
                  'Masofa',
                  Formatters.formatDistance(order.distanceKm! * 1000),
                ),
              if (order.durationMin != null)
                _buildDetailRow(
                  'Vaqt',
                  Formatters.formatDuration(order.durationMin!),
                ),
              if (order.status == OrderStatus.completed) ...[
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.of(ctx).pop();
                      _repeatOrder(context);
                    },
                    icon: const Icon(Icons.replay, size: 18),
                    label: const Text('Safarni takrorlash'),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(color: kTextSecondary, fontSize: 14),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w500,
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
