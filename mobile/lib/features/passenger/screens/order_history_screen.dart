import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

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
          // Uch holat: yuklanmoqda (skeleton, spinner emas) - xato - bo'sh.
          if (provider.state == OrderProviderState.loading &&
              provider.orderHistory.isEmpty) {
            return const AppSkeletonList(
              itemCount: 4,
              hasLeading: false,
              lines: 3,
              hasTrailing: true,
            );
          }

          if (provider.state == OrderProviderState.error) {
            return AppErrorState(
              message: provider.error ?? 'Xatolik yuz berdi',
              onRetry: provider.loadOrderHistory,
            );
          }

          if (provider.orderHistory.isEmpty) {
            return const AppEmptyState(
              icon: Icons.history,
              title: 'Sayohat tarixi yo\'q',
            );
          }

          return RefreshIndicator(
            onRefresh: provider.loadOrderHistory,
            color: kPrimary,
            child: ListView.separated(
              padding: const EdgeInsets.all(kSpace4),
              itemCount: provider.orderHistory.length,
              separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
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
        borderRadius: BorderRadius.circular(kRadiusLg),
        onTap: () => _showOrderDetails(context),
        child: Padding(
          padding: const EdgeInsets.all(kSpace4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    Formatters.formatRelativeDate(order.createdAt),
                    style: const TextStyle(
                      color: kInkMuted,
                      fontSize: kFontCaption,
                    ),
                  ),
                  _buildStatusBadge(order.status),
                ],
              ),
              const SizedBox(height: kSpace3),
              _buildRouteInfo(),
              const Divider(height: kSpace5),
              Row(
                children: [
                  if (order.driver != null) ...[
                    const ExcludeSemantics(
                      child: Icon(Icons.person_outline,
                          size: 16, color: kInkMuted),
                    ),
                    const SizedBox(width: kSpace1),
                    Text(
                      order.driver!.name,
                      style: const TextStyle(
                        fontSize: kFontLabel,
                        color: kInkMuted,
                      ),
                    ),
                    const Spacer(),
                  ],
                  Text(
                    Formatters.formatPrice(
                      order.actualPrice ?? order.estimatedPrice,
                    ),
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: kFontTitle,
                      color: kInk,
                    ),
                  ),
                ],
              ),
              if (order.status == OrderStatus.completed) ...[
                const SizedBox(height: kSpace3),
                AppOutlinedButton(
                  label: 'Safarni takrorlash',
                  icon: const Icon(Icons.replay, size: 18),
                  onPressed: () => _repeatOrder(context),
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

  /// Holat faqat RANG bilan berilmaydi — `AppStatusBadge` ikonka + matn +
  /// rangni birga tashiydi (WCAG 1.4.1).
  Widget _buildStatusBadge(OrderStatus status) {
    final tone = switch (status) {
      OrderStatus.completed => AppStatusTone.success,
      OrderStatus.cancelled => AppStatusTone.danger,
      _ => AppStatusTone.info,
    };
    return AppStatusBadge(label: status.label, tone: tone, dense: true);
  }

  Widget _buildRouteInfo() {
    return Column(
      children: [
        Row(
          children: [
            const ExcludeSemantics(
              child:
                  Icon(Icons.radio_button_checked, color: kPrimary, size: 16),
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
              child: Icon(Icons.location_on, color: kError, size: 16),
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
        borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (ctx, scrollController) => SingleChildScrollView(
          controller: scrollController,
          padding: const EdgeInsets.all(kSpace5),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: ExcludeSemantics(
                  child: Container(
                    width: kSpace10,
                    height: kSpace1,
                    decoration: BoxDecoration(
                      color: kLineStrong,
                      borderRadius: BorderRadius.circular(kRadiusFull),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: kSpace4),
              const Text(
                'Buyurtma tafsilotlari',
                style: TextStyle(
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ),
              const SizedBox(height: kSpace4),
              _buildDetailRow(
                  'Sana', Formatters.formatDateTime(order.createdAt)),
              _buildDetailRow('Holat', order.status.label),
              _buildDetailRow('Chiqish', order.pickup.address),
              _buildDetailRow('Manzil', order.dropoff.address),
              if (order.driver != null)
                _buildDetailRow('Haydovchi', order.driver!.name),
              if (order.driver != null)
                _buildDetailRow('Mashina', order.driver!.carInfo),
              _buildDetailRow(
                'Narx',
                Formatters.formatPrice(
                    order.actualPrice ?? order.estimatedPrice),
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
                const SizedBox(height: kSpace4),
                AppOutlinedButton(
                  label: 'Safarni takrorlash',
                  icon: const Icon(Icons.replay, size: 18),
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    _repeatOrder(context);
                  },
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
      padding: const EdgeInsets.symmetric(vertical: kSpace2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: const TextStyle(color: kInkMuted, fontSize: kFontBody),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: kFontBody,
                color: kInk,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
