import 'package:angren_taxi/features/superapp/screens/order_detail_screen.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';

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

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key, this.embedded = false});
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(18, MediaQuery.of(context).padding.top + 14, 18, 16),
            decoration: BoxDecoration(
              color: agSurface,
              boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.05), blurRadius: 20, offset: const Offset(0, 6))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (!embedded) ...[
                      AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop()),
                      const SizedBox(width: 12),
                    ],
                    const Text('Buyurtmalar',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: agText)),
                  ],
                ),
                const SizedBox(height: 14),
                const Row(
                  children: [
                    _SegChip(label: 'Faol', active: true),
                    SizedBox(width: 8),
                    _SegChip(label: 'Tarix', active: false),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 110),
              children: [
                _ActiveOrderCard(),
                const SizedBox(height: 22),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 2),
                  child: Text('Tarix', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: agText)),
                ),
                const SizedBox(height: 12),
                for (final o in _orders) ...[
                  _HistoryRow(
                    order: o,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => OrderDetailScreen(order: o)),
                    ),
                  ),
                  const SizedBox(height: 11),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SegChip extends StatelessWidget {
  const _SegChip({required this.label, required this.active});
  final String label;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: active ? agGreen : agBg,
        borderRadius: BorderRadius.circular(11),
      ),
      child: Text(label,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: active ? Colors.white : agText)),
    );
  }
}

class _ActiveOrderCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFDBF3E8), width: 1.5),
        boxShadow: agCardShadow,
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(color: agTint, borderRadius: BorderRadius.circular(13)),
                child: const Icon(Icons.local_taxi_rounded, color: agGreen, size: 24),
              ),
              const SizedBox(width: 12),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Taksi · Markaz → Uy', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: agText)),
                    Text('Bobur A. · 01 A 777 BB', style: TextStyle(fontSize: 12.5, color: agSubtle, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: agTint, borderRadius: BorderRadius.circular(9)),
                child: const Row(
                  children: [
                    SizedBox(width: 7, height: 7, child: DecoratedBox(decoration: BoxDecoration(color: agGreen, shape: BoxShape.circle))),
                    SizedBox(width: 5),
                    Text("Yo'lda", style: TextStyle(color: agGreen, fontSize: 11.5, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 13),
            child: Divider(color: Color(0xFFE7ECEF), height: 1),
          ),
          const Row(
            children: [
              Icon(Icons.schedule_rounded, size: 19, color: agGreen),
              SizedBox(width: 8),
              Text('3 daqiqada yetib keladi', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: agText)),
              Spacer(),
              Text('Kuzatish →', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: agGreen)),
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(18),
          boxShadow: agCardShadow,
        ),
        child: Row(
          children: [
            Container(
              width: 46,
              height: 46,
              decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(13)),
              child: Icon(order.icon, color: agSubtle, size: 23),
            ),
            const SizedBox(width: 13),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(order.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: agText)),
                  Text('${order.kind} · ${order.sub}',
                      style: const TextStyle(fontSize: 12, color: agSubtle, fontWeight: FontWeight.w600)),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(_som(order.amount),
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: agText)),
                const SizedBox(height: 2),
                Text(order.status, style: const TextStyle(fontSize: 11.5, color: agGreen, fontWeight: FontWeight.w700)),
              ],
            ),
          ],
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
