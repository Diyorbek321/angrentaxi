import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class CargoScreen extends StatefulWidget {
  const CargoScreen({super.key});

  @override
  State<CargoScreen> createState() => _CargoScreenState();
}

class _CargoScreenState extends State<CargoScreen> {
  int _selected = 0;

  static const _types = [
    (Icons.sports_motorsports_rounded, 'Kuryer', '5 kg gacha'),
    (Icons.airport_shuttle_rounded, 'Yengil', '300 kg gacha'),
    (Icons.local_shipping_rounded, 'Yuk', '1 t gacha'),
  ];

  void _callCourier() {
    // Cargo is backend-supported — hand off to the shared booking flow.
    context.read<OrderProvider>().setServiceType('cargo');
    Navigator.of(context).pushNamed('/passenger/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: 'Cargo · Yuk yetkazish',
            subtitle: 'Shahar ichida tez yetkazib berish',
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      _routeRow(agGreen, true, 'QAYERDAN', 'Markaz, Amir Temur 24'),
                      const Divider(color: agDivider, height: 1, indent: 23),
                      _routeRow(agRed, false, 'QAYERGA', 'Yangi shahar, 7-mavze'),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 2),
                  child: Text('Transport turi',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: agText)),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    for (var i = 0; i < _types.length; i++) ...[
                      if (i != 0) const SizedBox(width: 10),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _selected = i),
                          child: _TypeCard(
                            icon: _types[i].$1,
                            title: _types[i].$2,
                            sub: _types[i].$3,
                            active: _selected == i,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 18),
                Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(color: agInk, borderRadius: BorderRadius.circular(20)),
                  child: Stack(
                    clipBehavior: Clip.hardEdge,
                    children: [
                      Positioned(
                        right: -10,
                        bottom: -20,
                        child: Icon(Icons.local_shipping_rounded,
                            size: 96, color: agBright.withValues(alpha: 0.18)),
                      ),
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Taxminiy narx · 8.4 km',
                              style: TextStyle(color: Colors.white70, fontSize: 12.5, fontWeight: FontWeight.w700)),
                          SizedBox(height: 4),
                          Text("35 000 so'm",
                              style: TextStyle(color: Colors.white, fontSize: 26, fontWeight: FontWeight.w800)),
                          SizedBox(height: 2),
                          Text('Yetkazish ~ 40 daqiqa',
                              style: TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(16, 0, 16, MediaQuery.of(context).padding.bottom + 18),
            child: AgPrimaryButton(label: 'Kuryer chaqirish', onPressed: _callCourier),
          ),
        ],
      ),
    );
  }

  Widget _routeRow(Color dot, bool circle, String label, String value) {
    return SizedBox(
      height: 52,
      child: Row(
        children: [
          Container(
            width: 11,
            height: 11,
            decoration: BoxDecoration(
              color: dot,
              shape: circle ? BoxShape.circle : BoxShape.rectangle,
              borderRadius: circle ? null : BorderRadius.circular(3),
              boxShadow: circle ? [BoxShadow(color: dot.withValues(alpha: 0.16), blurRadius: 0, spreadRadius: 4)] : null,
            ),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label, style: const TextStyle(fontSize: 11, color: agMuted, fontWeight: FontWeight.w700)),
              Text(value, style: const TextStyle(fontSize: 14.5, color: agText, fontWeight: FontWeight.w700)),
            ],
          ),
        ],
      ),
    );
  }
}

class _TypeCard extends StatelessWidget {
  const _TypeCard({required this.icon, required this.title, required this.sub, required this.active});
  final IconData icon;
  final String title;
  final String sub;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: active ? agMint : agDivider, width: 1.5),
        boxShadow: active
            ? [BoxShadow(color: agGreen.withValues(alpha: 0.1), blurRadius: 20, offset: const Offset(0, 8))]
            : null,
      ),
      child: Column(
        children: [
          Icon(icon, size: 30, color: active ? agGreen : agSubtle),
          const SizedBox(height: 6),
          Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: agText)),
          Text(sub, style: const TextStyle(fontSize: 11, color: agSubtle, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
