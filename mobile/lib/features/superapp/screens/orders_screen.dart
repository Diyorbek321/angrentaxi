import 'package:angren_taxi/features/superapp/screens/order_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class OrderEntry {
  const OrderEntry({
    required this.kind,
    required this.icon,
    required this.title,
    required this.sub,
    required this.amount,
    required this.status,
    required this.from,
    required this.to,
  });

  final String kind;
  final IconData icon;
  final String title;
  final String sub;
  final double amount;
  final String status;
  final String from;
  final String to;
}

const _orders = [
  OrderEntry(kind: 'Taksi', icon: Icons.local_taxi_rounded, title: 'Markaz → Uy', sub: 'Bugun, 18:24', amount: 18000, status: 'Yakunlandi', from: 'Markaziy maydon', to: "Navoiy ko'chasi, 12"),
  OrderEntry(kind: 'Ovqat', icon: Icons.restaurant_rounded, title: 'Milliy Taomlar', sub: 'Kecha, 13:10', amount: 47000, status: 'Yetkazildi', from: 'Milliy Taomlar', to: "Navoiy ko'chasi, 12"),
  OrderEntry(kind: 'Market', icon: Icons.storefront_rounded, title: 'Korzinka Express', sub: '24-iyun, 11:02', amount: 62500, status: 'Yetkazildi', from: 'Korzinka Express', to: "Navoiy ko'chasi, 12"),
  OrderEntry(kind: 'Cargo', icon: Icons.local_shipping_rounded, title: 'Yuk · 2 ta quti', sub: '22-iyun, 09:40', amount: 35000, status: 'Yakunlandi', from: 'Amir Temur 24', to: 'Yangi shahar, 7-mavze'),
];

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key, this.embedded = false});
  final bool embedded;

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<MarketProvider>().loadOrderHistory();
      context.read<FoodProvider>().loadOrderHistory();
    });
  }

  bool get embedded => widget.embedded;

  @override
  Widget build(BuildContext context) {
    final market = context.watch<MarketProvider>();
    final food = context.watch<FoodProvider>();
    final marketOrders = market.orderHistory;
    final foodOrders = food.orderHistory;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(
                kSpace4, MediaQuery.of(context).padding.top + kSpace3, kSpace4, kSpace4),
            decoration: BoxDecoration(
              color: agSurface,
              boxShadow: agCardShadow,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (!embedded) ...[
                      AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop(), semanticsLabel: 'Orqaga'),
                      const SizedBox(width: kSpace3),
                    ],
                    const Text('Buyurtmalar',
                        style: TextStyle(fontSize: kFontH1, fontWeight: FontWeight.w800, color: agText)),
                  ],
                ),
                const SizedBox(height: kSpace4),
                const Row(
                  children: [
                    _SegChip(label: 'Faol', active: true),
                    SizedBox(width: kSpace2),
                    _SegChip(label: 'Tarix', active: false),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, 110),
              children: [
                _ActiveOrderCard(),
                const SizedBox(height: kSpace6),
                const _SectionTitle('Ovqat buyurtmalari'),
                const SizedBox(height: kSpace3),
                _OrderSectionBody(
                  isLoading: food.state == FoodProviderState.loading && foodOrders.isEmpty,
                  errorMessage: food.state == FoodProviderState.error && foodOrders.isEmpty
                      ? (food.error ?? 'Xatolik yuz berdi')
                      : null,
                  onRetry: () => context.read<FoodProvider>().loadOrderHistory(),
                  isEmpty: foodOrders.isEmpty,
                  emptyIcon: Icons.restaurant_rounded,
                  emptyTitle: 'Ovqat buyurtmalari yo\'q',
                  children: [
                    for (final o in foodOrders) ...[
                      _FoodHistoryRow(order: o),
                      const SizedBox(height: kSpace3),
                    ],
                  ],
                ),
                const SizedBox(height: kSpace6),
                const _SectionTitle('Market buyurtmalari'),
                const SizedBox(height: kSpace3),
                _OrderSectionBody(
                  isLoading:
                      market.state == MarketProviderState.loading && marketOrders.isEmpty,
                  errorMessage:
                      market.state == MarketProviderState.error && marketOrders.isEmpty
                          ? (market.error ?? 'Xatolik yuz berdi')
                          : null,
                  onRetry: () => context.read<MarketProvider>().loadOrderHistory(),
                  isEmpty: marketOrders.isEmpty,
                  emptyIcon: Icons.storefront_rounded,
                  emptyTitle: 'Market buyurtmalari yo\'q',
                  children: [
                    for (final o in marketOrders) ...[
                      _MarketHistoryRow(order: o),
                      const SizedBox(height: kSpace3),
                    ],
                  ],
                ),
                const SizedBox(height: kSpace6),
                const _SectionTitle('Tarix'),
                const SizedBox(height: kSpace3),
                for (final o in _orders) ...[
                  _HistoryRow(
                    order: o,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(order: o)),
                    ),
                  ),
                  const SizedBox(height: kSpace3),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text,
        style: const TextStyle(
            fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText));
  }
}

/// Ro'yxat bo'limi uchun uchta holat: yuklanmoqda · xato · bo'sh.
class _OrderSectionBody extends StatelessWidget {
  const _OrderSectionBody({
    required this.isLoading,
    required this.errorMessage,
    required this.onRetry,
    required this.isEmpty,
    required this.emptyIcon,
    required this.emptyTitle,
    required this.children,
  });

  final bool isLoading;
  final String? errorMessage;
  final VoidCallback onRetry;
  final bool isEmpty;
  final IconData emptyIcon;
  final String emptyTitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const AppSkeletonList(itemCount: 2, padding: EdgeInsets.zero);
    }
    if (errorMessage != null) {
      return InlineErrorWidget(message: errorMessage!, onRetry: onRetry);
    }
    if (isEmpty) {
      return AppEmptyState(icon: emptyIcon, title: emptyTitle, compact: true);
    }
    return Column(children: children);
  }
}

class _SegChip extends StatelessWidget {
  const _SegChip({required this.label, required this.active});
  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: kSpace4, vertical: kSpace2),
      decoration: BoxDecoration(
        color: active ? agPrimary : agBg,
        borderRadius: BorderRadius.circular(kRadiusSm),
      ),
      child: Text(label,
          style: TextStyle(
              fontSize: kFontLabel,
              fontWeight: FontWeight.w700,
              color: active ? agOnPrimary : agText)),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusLg),
        border: Border.all(color: agTint, width: 1.5),
        boxShadow: agCardShadow,
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(color: agTint, borderRadius: BorderRadius.circular(kRadiusSm)),
                child: const Icon(Icons.local_taxi_rounded, color: agGreenText, size: 24),
              ),
              const SizedBox(width: kSpace3),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Taksi · Markaz → Uy', style: TextStyle(fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                    Text('Bobur A. · 01 A 777 BB', style: TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              Semantics(
                container: true,
                label: "Holat: Yo'lda",
                excludeSemantics: true,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: kSpace3, vertical: kSpace1 + 2),
                  decoration: BoxDecoration(color: agTint, borderRadius: BorderRadius.circular(kRadiusXs)),
                  child: const Row(
                    children: [
                      SizedBox(width: 7, height: 7, child: DecoratedBox(decoration: BoxDecoration(color: kMintDeep, shape: BoxShape.circle))),
                      SizedBox(width: kSpace1 + 1),
                      Text("Yo'lda", style: TextStyle(color: kPrimary, fontSize: kFontMicro, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: kSpace3),
            child: Divider(color: agBorder, height: 1),
          ),
          const Row(
            children: [
              Icon(Icons.schedule_rounded, size: 19, color: agGreenText),
              SizedBox(width: kSpace2),
              Text('3 daqiqada yetib keladi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: kFontLabel, color: agText)),
              Spacer(),
              Text('Kuzatish →', style: TextStyle(fontWeight: FontWeight.w700, fontSize: kFontLabel, color: agGreenText)),
            ],
          ),
        ],
      ),
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({required this.order, required this.onTap});
  final OrderEntry order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '${order.title}, ${order.kind}, ${order.status}',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          constraints: const BoxConstraints(minHeight: kMinTapTarget),
          padding: const EdgeInsets.all(kSpace4),
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusMd),
            boxShadow: agCardShadow,
          ),
          child: Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(kRadiusSm)),
                child: Icon(order.icon, color: agSubtle, size: 23),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                    Text('${order.kind} · ${order.sub}',
                        style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              const SizedBox(width: kSpace2),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(_som(order.amount),
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                  const SizedBox(height: kSpace1),
                  AppStatusBadge(
                    label: order.status,
                    tone: AppStatusTone.success,
                    dense: true,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _som(double v) {
    final s = v.toInt().toString();
    final buf = StringBuffer();
    for (var i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 == 0) buf.write(' ');
      buf.write(s[i]);
    }
    return "$buf so'm";
  }
}

class _MarketHistoryRow extends StatelessWidget {
  const _MarketHistoryRow({required this.order});
  final MarketOrder order;

  AppStatusTone get _tone {
    if (order.status == MarketOrderStatus.cancelled) return AppStatusTone.danger;
    if (order.status.isActive) return AppStatusTone.info;
    return AppStatusTone.success;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: kMinTapTarget),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        boxShadow: agCardShadow,
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(kRadiusSm)),
            child: const Icon(Icons.storefront_rounded, color: agSubtle, size: 23),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${order.itemsCount} ta mahsulot',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                Text('Market · #${order.id.substring(0, 6)}',
                    style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(width: kSpace2),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(_HistoryRow._som(order.totalPrice),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
              const SizedBox(height: kSpace1),
              AppStatusBadge(label: order.status.label, tone: _tone, dense: true),
            ],
          ),
        ],
      ),
    );
  }
}

class _FoodHistoryRow extends StatelessWidget {
  const _FoodHistoryRow({required this.order});
  final FoodOrder order;

  AppStatusTone get _tone {
    if (order.status == FoodOrderStatus.cancelled) return AppStatusTone.danger;
    if (order.status.isActive) return AppStatusTone.info;
    return AppStatusTone.success;
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: kMinTapTarget),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        boxShadow: agCardShadow,
      ),
      child: Row(
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(kRadiusSm)),
            child: const Icon(Icons.restaurant_rounded, color: agSubtle, size: 23),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${order.itemsCount} ta taom',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                Text('Ovqat · #${order.id.substring(0, 6)}',
                    style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(width: kSpace2),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(_HistoryRow._som(order.totalPrice),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
              const SizedBox(height: kSpace1),
              AppStatusBadge(label: order.status.label, tone: _tone, dense: true),
            ],
          ),
        ],
      ),
    );
  }
}
