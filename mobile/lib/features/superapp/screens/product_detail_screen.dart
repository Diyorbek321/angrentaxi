import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/cart_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/market_product.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Shows a real `/market` product. Only backend-backed products are accepted —
/// a mock product would put an id the server doesn't know into the cart and
/// fail at checkout.
class ProductDetailScreen extends StatelessWidget {
  const ProductDetailScreen({super.key, required this.marketProduct});

  final MarketProduct marketProduct;

  String get _id => marketProduct.id;
  String get _name => marketProduct.name;
  double get _price => marketProduct.price;
  String get _unit => marketProduct.unit;
  Color get _color => marketProduct.color;
  IconData get _icon => marketProduct.icon;
  String get _emoji => marketProduct.emoji;
  bool get _isAvailable => marketProduct.isAvailable;

  void _add(BuildContext context) {
    context.read<SuperappProvider>().addToCart(
          CartItem(id: _id, name: _name, price: _price, qty: 1, icon: _icon, color: _color),
        );
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SuperappProvider>();
    final topPad = MediaQuery.of(context).padding.top;
    final bottomPad = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: agSurface,
      body: Stack(
        children: [
          ListView(
            padding: EdgeInsets.zero,
            children: [
              SizedBox(
                height: 260,
                child: Stack(
                  children: [
                    Container(
                      height: 260,
                      width: double.infinity,
                      color: _color,
                      alignment: Alignment.center,
                      child: ExcludeSemantics(
                        child: _emoji.isNotEmpty
                            ? Text(_emoji, style: const TextStyle(fontSize: 96))
                            : Icon(_icon, size: 120, color: agOnPrimary.withValues(alpha: 0.92)),
                      ),
                    ),
                    Positioned(
                      top: topPad + kSpace2,
                      left: kSpace4,
                      child: AgIconButton(
                        icon: Icons.arrow_back_rounded,
                        onTap: () => Navigator.of(context).pop(),
                        semanticsLabel: 'Orqaga',
                        background: agSurface,
                        size: 44,
                      ),
                    ),
                  ],
                ),
              ),
              Transform.translate(
                offset: const Offset(0, -22),
                child: Container(
                  decoration: const BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusXl)),
                  ),
                  padding: const EdgeInsets.fromLTRB(kSpace4, kSpace5, kSpace4, 160),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Do\'kon · $_unit',
                          style: const TextStyle(
                              fontSize: kFontCaption, color: agMuted, fontWeight: FontWeight.w700)),
                      const SizedBox(height: kSpace1),
                      Text(_name,
                          style: const TextStyle(
                              fontSize: kFontH1,
                              fontWeight: FontWeight.w800,
                              color: agText,
                              letterSpacing: -0.4)),
                      const SizedBox(height: kSpace3),
                      Text(Formatters.formatSom(_price),
                          style: const TextStyle(
                              fontSize: kFontH1, fontWeight: FontWeight.w800, color: agGreenText)),
                      const SizedBox(height: kSpace4),
                      const Text(
                        "Yangi va sifatli mahsulot, yaqin do'kondan tez yetkazib beriladi.",
                        style: TextStyle(
                            fontSize: kFontLabel,
                            color: agSubtle,
                            fontWeight: FontWeight.w500,
                            height: 1.6),
                      ),
                      const SizedBox(height: kSpace4),
                      Row(
                        children: [
                          const Expanded(child: _InfoChip(label: 'YETKAZISH', value: '15–25 daq')),
                          const SizedBox(width: kSpace3),
                          const Expanded(child: _InfoChip(label: 'REYTING', value: '4.8 ★')),
                          const SizedBox(width: kSpace3),
                          Expanded(
                            child: _InfoChip(
                              label: 'OMBOR',
                              value: _isAvailable ? 'Mavjud' : 'Tugagan',
                              valueColor: _isAvailable ? agGreenText : kErrorDeep,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          Positioned(
            left: kSpace4,
            right: kSpace4,
            bottom: bottomPad + kSpace4,
            child: Column(
              children: [
                if (provider.cartCount > 0) ...[
                  AgCartBar(
                    count: provider.cartCount,
                    label: 'Savatga buyurtma',
                    trailing: Formatters.formatSom(provider.cartSubtotal),
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const CartScreen()),
                    ),
                  ),
                  const SizedBox(height: kSpace3),
                ],
                AgPrimaryButton(
                  label: 'Savatga · ${Formatters.formatSom(_price)}',
                  icon: Icons.add_shopping_cart_rounded,
                  onPressed: _isAvailable ? () => _add(context) : null,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip({required this.label, required this.value, this.valueColor = agText});
  final String label;
  final String value;
  final Color valueColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: agSurface2,
        borderRadius: BorderRadius.circular(kRadiusSm),
      ),
      child: Column(
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w700)),
          const SizedBox(height: kSpace1),
          Text(value,
              style: TextStyle(
                  fontSize: kFontLabel, fontWeight: FontWeight.w800, color: valueColor)),
        ],
      ),
    );
  }
}
