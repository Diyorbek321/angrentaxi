import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Yo'lovchining kelgusi rejalashtirilgan safarlari.
///
/// Bu ekran ATAYLAB bosh ekrandan alohida: rejalashtirilgan buyurtma
/// `isActive` emas, ya'ni u bosh ekrandagi kuzatuv oqimiga umuman
/// kirmaydi (`order.dart#isActive` dagi izohga qarang).
class ScheduledOrdersScreen extends StatefulWidget {
  const ScheduledOrdersScreen({super.key});

  @override
  State<ScheduledOrdersScreen> createState() => _ScheduledOrdersScreenState();
}

class _ScheduledOrdersScreenState extends State<ScheduledOrdersScreen> {
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    // `addPostFrameCallback` — `initState` ichida provider'ga yozish
    // build paytida `notifyListeners()` chaqirishga olib keladi.
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await context.read<OrderProvider>().loadScheduledOrders();
      if (mounted) setState(() => _loading = false);
    });
  }

  Future<void> _cancel(Order order) async {
    final provider = context.read<OrderProvider>();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: Text(context.l10n.paxCancelScheduleTitle),
        content: Text(
          context.l10n.paxCancelScheduleBody(
            Formatters.formatScheduleLabel(order.scheduledAt ?? order.createdAt),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(context.l10n.paxNo),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(context.l10n.paxCancel),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final ok = await provider.cancelScheduledOrder(order.id);
    if (!mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? context.l10n.paxScheduleCancelled
              : (provider.error ?? context.l10n.paxCancelFailed),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      appBar: AppBar(
        backgroundColor: kSurface,
        surfaceTintColor: Colors.transparent,
        title: Text(
          context.l10n.paxScheduledTripsTitle,
          style: const TextStyle(
            fontSize: kFontH3,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
      ),
      body: Consumer<OrderProvider>(
        builder: (context, provider, _) {
          if (_loading) {
            return const Padding(
              padding: kScreenPadding,
              child: AppSkeletonList(itemCount: 3, lines: 3),
            );
          }

          final orders = provider.scheduledOrders;
          if (orders.isEmpty) {
            return AppEmptyState(
              icon: Icons.schedule_rounded,
              title: context.l10n.paxScheduledEmptyTitle,
              message: context.l10n.paxScheduledEmptyBody,
            );
          }

          return RefreshIndicator(
            onRefresh: provider.loadScheduledOrders,
            child: ListView.separated(
              padding: EdgeInsets.all(context.gutter),
              itemCount: orders.length,
              separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
              itemBuilder: (context, i) => _ScheduledCard(
                order: orders[i],
                onCancel: () => _cancel(orders[i]),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _ScheduledCard extends StatelessWidget {
  const _ScheduledCard({required this.order, required this.onCancel});

  final Order order;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final when = order.scheduledAt;

    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusLg),
        boxShadow: kShadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.schedule_rounded, size: 20, color: kPrimary),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  when != null
                      ? Formatters.formatScheduleLabel(when)
                      : order.status.label,
                  style: const TextStyle(
                    fontSize: kFontH3,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
              ),
              Text(
                Formatters.formatSom(order.estimatedPrice),
                style: const TextStyle(
                  fontSize: kFontTitle,
                  fontWeight: FontWeight.w800,
                  color: kPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace3),
          _AddressRow(
            color: kPrimary,
            text: order.pickup.address.isEmpty
                ? context.l10n.paxPickupPoint
                : order.pickup.address,
          ),
          const SizedBox(height: kSpace2),
          _AddressRow(
            color: kError,
            text: order.dropoff.address.isEmpty
                ? context.l10n.paxDestination
                : order.dropoff.address,
          ),
          const SizedBox(height: kSpace3),
          // Narx qotirilgani ochiq aytiladi — bu rejalashtirishning asosiy
          // va'dasi, va uni aytmasak yo'lovchi "safar paytida qimmatlashadimi?"
          // deb o'ylab qoladi.
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: kSpace3,
              vertical: kSpace2,
            ),
            decoration: BoxDecoration(
              color: kInfoLight,
              borderRadius: BorderRadius.circular(kRadiusSm),
            ),
            child: Text(
              context.l10n.paxPriceLocked,
              style: const TextStyle(
                fontSize: kFontCaption,
                fontWeight: FontWeight.w600,
                color: kInfoDeep,
              ),
            ),
          ),
          const SizedBox(height: kSpace3),
          Semantics(
            button: true,
            child: AppPressable(
              onTap: onCancel,
              haptic: AppHapticLevel.impact,
              pressedScale: 0.97,
              minTapTarget: false,
              child: Container(
                width: double.infinity,
                height: kControlHeightSm,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: kErrorLight,
                  borderRadius: BorderRadius.circular(kRadiusMd),
                  border: Border.all(color: kErrorBorder),
                ),
                child: Text(
                  context.l10n.paxCancel,
                  style: const TextStyle(
                    fontSize: kFontBody,
                    fontWeight: FontWeight.w700,
                    color: kErrorDeep,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddressRow extends StatelessWidget {
  const _AddressRow({required this.color, required this.text});

  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 5),
          child: ExcludeSemantics(
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
          ),
        ),
        const SizedBox(width: kSpace3),
        Expanded(
          child: Text(
            text,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: kFontBody,
              fontWeight: FontWeight.w600,
              color: kInkMuted,
            ),
          ),
        ),
      ],
    );
  }
}
