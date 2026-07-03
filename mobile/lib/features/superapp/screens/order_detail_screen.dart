import 'package:angren_taxi/features/superapp/screens/orders_screen.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';

class OrderDetailScreen extends StatelessWidget {
  const OrderDetailScreen({super.key, required this.order});
  final OrderEntry order;

  bool get _isTaxi => order.kind == 'Taksi';

  @override
  Widget build(BuildContext context) {
    final base = order.amount * 0.85;
    final fee = order.amount - base;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: order.title,
            subtitle: '${order.kind} · ${order.sub}',
            onBack: () => Navigator.of(context).pop(),
            trailing: const AgIconButton(icon: Icons.ios_share_rounded, onTap: _noop, color: agSubtle),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _card(
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(color: agTint, borderRadius: BorderRadius.circular(14)),
                        child: const Icon(Icons.check_circle_rounded, color: agGreen, size: 25),
                      ),
                      const SizedBox(width: 13),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(order.status, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: agText)),
                            const Text('Buyurtma muvaffaqiyatli bajarildi',
                                style: TextStyle(fontSize: 12.5, color: agSubtle, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      Text(Formatters.formatSom(order.amount),
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: agText)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                _card(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Column(
                        children: [
                          const SizedBox(height: 4),
                          Container(width: 11, height: 11, decoration: const BoxDecoration(color: agGreen, shape: BoxShape.circle)),
                          Expanded(child: Container(width: 2, color: agBorder, margin: const EdgeInsets.symmetric(vertical: 4))),
                          Container(width: 11, height: 11, decoration: BoxDecoration(color: agRed, borderRadius: BorderRadius.circular(3))),
                          const SizedBox(height: 4),
                        ],
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _addr('QAYERDAN', order.from),
                            const Divider(color: agDivider, height: 24),
                            _addr('QAYERGA', order.to),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (_isTaxi) ...[
                  const SizedBox(height: 14),
                  _card(
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(colors: [agBright, agGreen]),
                            shape: BoxShape.circle,
                          ),
                          child: const Text('B', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
                        ),
                        const SizedBox(width: 13),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Bobur A.', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14.5, color: agText)),
                              Row(
                                children: [
                                  Icon(Icons.star_rounded, size: 14, color: agOrange),
                                  SizedBox(width: 4),
                                  Text('4.9 · Cobalt · 01 A 777 BB',
                                      style: TextStyle(fontSize: 12, color: agSubtle, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const AgIconButton(icon: Icons.call_rounded, onTap: _noop, color: agSubtle),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 14),
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text("To'lov tafsiloti", style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: agText)),
                      const SizedBox(height: 14),
                      _payRow('Asosiy summa', Formatters.formatSom(base)),
                      const SizedBox(height: 10),
                      _payRow(_isTaxi ? 'Xizmat haqi' : 'Yetkazib berish', Formatters.formatSom(fee)),
                      const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(color: Color(0xFFDCE2E6), height: 1)),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Jami', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: agText)),
                          Text(Formatters.formatSom(order.amount),
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: agText)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: 52,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: agSurface,
                          borderRadius: BorderRadius.circular(15),
                          border: Border.all(color: const Color(0xFFE7ECEF)),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.help_outline_rounded, size: 20, color: agSubtle),
                            SizedBox(width: 8),
                            Text('Yordam', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: agText)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      flex: 14,
                      child: GestureDetector(
                        onTap: () => Navigator.of(context).pop(),
                        child: Container(
                          height: 52,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(gradient: agCta, borderRadius: BorderRadius.circular(15)),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.replay_rounded, size: 20, color: Colors.white),
                              SizedBox(width: 8),
                              Text('Takrorlash', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: Colors.white)),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static void _noop() {}

  Widget _card({required Widget child}) => Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: agCardShadow,
        ),
        child: child,
      );

  Widget _addr(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: agMuted, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText)),
        ],
      );

  Widget _payRow(String label, String value) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13.5, color: agSubtle, fontWeight: FontWeight.w600)),
          Text(value, style: const TextStyle(fontSize: 13.5, color: agText, fontWeight: FontWeight.w700)),
        ],
      );
}
