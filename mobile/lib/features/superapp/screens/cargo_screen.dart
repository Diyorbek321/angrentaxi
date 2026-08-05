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
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      _routeRow(kMintDeep, true, 'QAYERDAN', 'Markaz, Amir Temur 24'),
                      const Divider(color: agDivider, height: 1, indent: 23),
                      _routeRow(agRed, false, 'QAYERGA', 'Yangi shahar, 7-mavze'),
                    ],
                  ),
                ),
                const SizedBox(height: kSpace5),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 2),
                  child: Text('Transport turi',
                      style: TextStyle(
                          fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText)),
                ),
                const SizedBox(height: kSpace3),
                Row(
                  children: [
                    for (var i = 0; i < _types.length; i++) ...[
                      if (i != 0) const SizedBox(width: kSpace3),
                      Expanded(
                        child: Semantics(
                          button: true,
                          selected: _selected == i,
                          child: GestureDetector(
                            onTap: () => setState(() => _selected = i),
                            behavior: HitTestBehavior.opaque,
                            child: _TypeCard(
                              icon: _types[i].$1,
                              title: _types[i].$2,
                              sub: _types[i].$3,
                              active: _selected == i,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: kSpace4),
                Container(
                  padding: const EdgeInsets.all(kSpace5),
                  decoration: BoxDecoration(
                    color: agInk,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                  ),
                  child: Stack(
                    clipBehavior: Clip.hardEdge,
                    children: [
                      Positioned(
                        right: -10,
                        bottom: -20,
                        child: ExcludeSemantics(
                          child: Icon(Icons.local_shipping_rounded,
                              size: 96, color: agBright.withValues(alpha: 0.18)),
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Taxminiy narx · 8.4 km',
                              style: TextStyle(
                                  color: agOnPrimary.withValues(alpha: 0.7),
                                  fontSize: kFontCaption,
                                  fontWeight: FontWeight.w700)),
                          const SizedBox(height: kSpace1),
                          const Text("35 000 so'm",
                              style: TextStyle(
                                  color: agOnPrimary,
                                  fontSize: kFontDisplay,
                                  fontWeight: FontWeight.w800)),
                          const SizedBox(height: 2),
                          Text('Yetkazish ~ 40 daqiqa',
                              style: TextStyle(
                                  color: agOnPrimary.withValues(alpha: 0.7),
                                  fontSize: kFontCaption,
                                  fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
                kSpace4, 0, kSpace4, MediaQuery.of(context).padding.bottom + kSpace4),
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
          ExcludeSemantics(
            child: Container(
              width: 11,
              height: 11,
              decoration: BoxDecoration(
                color: dot,
                shape: circle ? BoxShape.circle : BoxShape.rectangle,
                borderRadius: circle ? null : BorderRadius.circular(3),
                boxShadow: circle
                    ? [
                        BoxShadow(
                          color: dot.withValues(alpha: 0.16),
                          blurRadius: 0,
                          spreadRadius: 4,
                        ),
                      ]
                    : null,
              ),
            ),
          ),
          const SizedBox(width: kSpace3),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(label,
                  style: const TextStyle(
                      fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w700)),
              Text(value,
                  style: const TextStyle(
                      fontSize: kFontBody, color: agText, fontWeight: FontWeight.w700)),
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
      constraints: const BoxConstraints(minHeight: kMinTapTarget),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: active ? agTint : agSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: active ? agPrimary : agDivider, width: 1.5),
        boxShadow: active ? agSoftShadow : null,
      ),
      child: Column(
        children: [
          ExcludeSemantics(
            child: Icon(icon, size: 30, color: active ? agPrimary : agSubtle),
          ),
          const SizedBox(height: kSpace2),
          Text(title,
              style: TextStyle(
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w800,
                  color: active ? agGreenText : agText)),
          Text(sub,
              style: const TextStyle(
                  fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
