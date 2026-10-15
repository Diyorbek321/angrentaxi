import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/screens/courier_tracking_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/superapp/widgets/vendor_cancel_flow.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/address_details.dart';
import 'package:angren_taxi/shared/models/courier_tracking.dart';
import 'package:angren_taxi/shared/models/food_order.dart';
import 'package:angren_taxi/shared/models/market_order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Ovqat va market buyurtmasining bitta ko'rinishi — ekran ikkala modelni
/// shu adapter orqali chizadi.
@immutable
class VendorOrderView {
  const VendorOrderView({
    required this.kind,
    required this.id,
    required this.statusLabel,
    required this.tone,
    required this.isActive,
    required this.canCancel,
    required this.items,
    required this.address,
    required this.total,
    required this.createdAt,
    this.addressDetails,
    this.promoCode,
    this.promoDiscount = 0,
    this.promotionDiscount = 0,
    this.cancelReason,
    this.delivery,
    this.trackPath,
  });

  final String kind;
  final String id;
  final String statusLabel;
  final AppStatusTone tone;
  final bool isActive;
  final bool canCancel;
  final List<({String name, int qty, double price})> items;
  final String address;
  final double total;
  final DateTime createdAt;
  final AddressDetails? addressDetails;
  final String? promoCode;
  final double promoDiscount;
  final double promotionDiscount;
  final String? cancelReason;
  final CourierTracking? delivery;
  final String? trackPath;

  factory VendorOrderView.food(FoodOrder o) => VendorOrderView(
        kind: 'food',
        id: o.id,
        statusLabel: o.status.label,
        tone: switch (o.status) {
          FoodOrderStatus.cancelled => AppStatusTone.danger,
          FoodOrderStatus.delivered => AppStatusTone.success,
          _ => AppStatusTone.info,
        },
        isActive: o.status.isActive,
        canCancel: o.canCancel,
        items: [for (final i in o.items) (name: i.name, qty: i.qty, price: i.price)],
        address: o.deliveryAddress,
        total: o.payableTotal,
        createdAt: o.createdAt,
        addressDetails: o.addressDetails,
        promoCode: o.promoCode,
        promoDiscount: o.promoDiscount,
        promotionDiscount: o.promotionDiscount,
        cancelReason: o.cancelReason,
        delivery: o.isTrackable ? o.delivery : null,
        trackPath: ApiEndpoints.foodOrderById(o.id),
      );

  factory VendorOrderView.market(MarketOrder o) => VendorOrderView(
        kind: 'market',
        id: o.id,
        statusLabel: o.status.label,
        tone: switch (o.status) {
          MarketOrderStatus.cancelled => AppStatusTone.danger,
          MarketOrderStatus.delivered => AppStatusTone.success,
          _ => AppStatusTone.info,
        },
        isActive: o.status.isActive,
        canCancel: o.canCancel,
        items: [for (final i in o.items) (name: i.name, qty: i.qty, price: i.price)],
        address: o.deliveryAddress,
        total: o.payableTotal,
        createdAt: o.createdAt,
        addressDetails: o.addressDetails,
        promoCode: o.promoCode,
        promoDiscount: o.promoDiscount,
        promotionDiscount: o.promotionDiscount,
        cancelReason: o.cancelReason,
        delivery: o.isTrackable ? o.delivery : null,
        trackPath: ApiEndpoints.marketOrderById(o.id),
      );
}

/// Provayderdagi JONLI nusxa — bekor qilingach yoki holat o'zgarganda ekran
/// o'zi yangilanadi.
VendorOrderView? findVendorOrder(BuildContext context, String kind, String id) {
  if (kind == 'food') {
    final food = context.watch<FoodProvider>();
    final active = food.activeOrder;
    final order = food.orderHistory.where((o) => o.id == id).firstOrNull ??
        (active?.id == id ? active : null);
    return order == null ? null : VendorOrderView.food(order);
  }
  final market = context.watch<MarketProvider>();
  final active = market.activeOrder;
  final order = market.orderHistory.where((o) => o.id == id).firstOrNull ??
      (active?.id == id ? active : null);
  return order == null ? null : VendorOrderView.market(order);
}

/// Ovqat / market buyurtmasi tafsiloti: holat, tarkib, manzil tafsilotlari,
/// chegirmalar, kuryer kuzatuvi va BEKOR QILISH.
class VendorOrderDetailScreen extends StatelessWidget {
  const VendorOrderDetailScreen({super.key, required this.kind, required this.orderId});

  final String kind;
  final String orderId;

  @override
  Widget build(BuildContext context) {
    final order = findVendorOrder(context, kind, orderId);
    final l10n = context.l10n;
    final shortId = orderId.split('-').first.toUpperCase();

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: l10n.saOrderDetailTitle(shortId),
            subtitle: order == null ? null : Formatters.formatDateTime(order.createdAt),
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: order == null
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    padding: EdgeInsets.fromLTRB(
                        kSpace4, kSpace4, kSpace4, kSpace6 + MediaQuery.paddingOf(context).bottom),
                    children: [
                      _card(
                        Row(
                          children: [
                            Expanded(
                              child: Align(
                                alignment: Alignment.centerLeft,
                                child: AppStatusBadge(label: order.statusLabel, tone: order.tone),
                              ),
                            ),
                            const SizedBox(width: kSpace2),
                            Text(
                              Formatters.formatSom(order.total),
                              style: const TextStyle(
                                  fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText),
                            ),
                          ],
                        ),
                      ),
                      if (order.cancelReason != null && !order.isActive) ...[
                        const SizedBox(height: kSpace2),
                        Text(
                          l10n.saCancelReasonLabel(order.cancelReason!),
                          style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
                        ),
                      ],
                      if (order.delivery != null) ...[
                        const SizedBox(height: kSpace4),
                        AgPrimaryButton(
                          label: l10n.saTrackCourier,
                          icon: Icons.near_me_rounded,
                          onPressed: () => Navigator.of(context).push(
                            MaterialPageRoute<void>(
                              builder: (_) => CourierTrackingScreen(
                                refreshPath: order.trackPath!,
                                initial: order.delivery!,
                              ),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: kSpace4),
                      _card(_ItemsBlock(order: order)),
                      const SizedBox(height: kSpace4),
                      _card(_AddressBlock(order: order)),
                      if (order.isActive) ...[
                        const SizedBox(height: kSpace5),
                        VendorCancelAction(
                          kind: kind,
                          canCancel: order.canCancel,
                          onCancel: () => runVendorCancelFlow(context, kind: kind, orderId: orderId),
                        ),
                      ],
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  static Widget _card(Widget child) => Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(kRadiusLg),
          boxShadow: agCardShadow,
        ),
        child: child,
      );
}

class _ItemsBlock extends StatelessWidget {
  const _ItemsBlock({required this.order});
  final VendorOrderView order;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.saOrderItems,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
        const SizedBox(height: kSpace2),
        for (final item in order.items)
          _Line(label: '${item.qty} × ${item.name}', value: Formatters.formatSom(item.price * item.qty)),
        if (order.promotionDiscount > 0)
          _Line(
            label: l10n.saVendorDiscountLine,
            value: '−${Formatters.formatSom(order.promotionDiscount)}',
            valueColor: agGreenText,
          ),
        if (order.promoDiscount > 0)
          _Line(
            label: order.promoCode == null ? l10n.saPromoDiscount : l10n.saPromoCodeLine(order.promoCode!),
            value: '−${Formatters.formatSom(order.promoDiscount)}',
            valueColor: agGreenText,
          ),
        const Divider(color: agBorder, height: kSpace5),
        _Line(label: l10n.saTotal, value: Formatters.formatSom(order.total), bold: true),
      ],
    );
  }
}

class _AddressBlock extends StatelessWidget {
  const _AddressBlock({required this.order});
  final VendorOrderView order;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final d = order.addressDetails;
    final parts = <String>[
      if (d?.entrance != null) '${l10n.saAddressEntrance} ${d!.entrance}',
      if (d?.floor != null) '${l10n.saAddressFloor} ${d!.floor}',
      if (d?.apartment != null) '${l10n.saAddressApartment} ${d!.apartment}',
      if (d?.intercom != null) '${l10n.saAddressIntercom} ${d!.intercom}',
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(l10n.saDeliveryAddress,
            style: const TextStyle(fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(order.address,
            style: const TextStyle(fontSize: kFontBody, color: agText, fontWeight: FontWeight.w600)),
        if (parts.isNotEmpty) ...[
          const SizedBox(height: kSpace1),
          Text(parts.join(' · '),
              style: const TextStyle(fontSize: kFontLabel, color: agText, fontWeight: FontWeight.w500)),
        ],
        if (d?.landmark != null) ...[
          const SizedBox(height: kSpace1),
          Text('${l10n.saAddressLandmark}: ${d!.landmark}',
              style: const TextStyle(fontSize: kFontLabel, color: agSubtle)),
        ],
        if (d?.courierNote != null) ...[
          const SizedBox(height: kSpace1),
          Text('${l10n.saAddressCourierNote}: ${d!.courierNote}',
              style: const TextStyle(fontSize: kFontLabel, color: agSubtle)),
        ],
      ],
    );
  }
}

class _Line extends StatelessWidget {
  const _Line({required this.label, required this.value, this.bold = false, this.valueColor = agText});
  final String label;
  final String value;
  final bool bold;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    final weight = bold ? FontWeight.w800 : FontWeight.w600;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: kSpace1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(label, style: TextStyle(fontSize: kFontBody, color: bold ? agText : agSubtle, fontWeight: weight)),
          ),
          const SizedBox(width: kSpace2),
          Text(value, style: TextStyle(fontSize: kFontBody, color: valueColor, fontWeight: weight)),
        ],
      ),
    );
  }
}
