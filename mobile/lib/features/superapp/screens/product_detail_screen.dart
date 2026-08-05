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
                      child: _emoji.isNotEmpty
                          ? Text(_emoji, style: const TextStyle(fontSize: 96))
                          : Icon(_icon, size: 120, color: Colors.white.withValues(alpha: 0.92)),
                    ),
                    Positioned(
                      top: topPad + 8,
                      left: 16,
                      child: GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.92),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(Icons.arrow_back_rounded, color: agText, size: 23),
                        ),
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
                    borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  ),
                  padding: const EdgeInsets.fromLTRB(18, 22, 18, 160),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Do\'kon · $_unit',
                          style: const TextStyle(fontSize: 12.5, color: agMuted, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(_name,
                          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: agText, letterSpacing: -0.4)),
                      const SizedBox(height: 10),
                      Text(Formatters.formatSom(_price),
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: agGreen)),
                      const SizedBox(height: 14),
                      const Text(
                        "Yangi va sifatli mahsulot, yaqin do'kondan tez yetkazib beriladi.",
                        style: TextStyle(fontSize: 13.5, color: agSubtle, fontWeight: FontWeight.w500, height: 1.6),
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          const Expanded(child: _InfoChip(label: 'YETKAZISH', value: '15–25 daq')),
                          const SizedBox(width: 10),
                          const Expanded(child: _InfoChip(label: 'REYTING', value: '4.8 ★')),
                          const SizedBox(width: 10),
                          Expanded(
                            child: _InfoChip(
                              label: 'OMBOR',
                              value: _isAvailable ? 'Mavjud' : 'Tugagan',
                              valueColor: _isAvailable ? agGreen : agRed,
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
            left: 16,
            right: 16,
            bottom: bottomPad + 18,
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
                  const SizedBox(height: 10),
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
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFF8FAFB), borderRadius: BorderRadius.circular(14)),
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: agMuted, fontWeight: FontWeight.w700)),
          const SizedBox(height: 3),
          Text(value, style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w800, color: valueColor)),
        ],
      ),
    );
  }
}
