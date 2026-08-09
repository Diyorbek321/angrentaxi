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
    // Cargo is backend-supported — hand off to the shared booking flow, which
    // owns address selection and the real distance-based quote. The selected
    // vehicle type travels with the order instead of being thrown away.
    context
        .read<OrderProvider>()
        .setServiceType('cargo', cargoVehicle: _types[_selected].$2);
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
                  padding: const EdgeInsets.all(kSpace4),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agCardShadow,
                  ),
                  child: const Row(
                    children: [
                      ExcludeSemantics(
                        child: Icon(Icons.info_outline_rounded,
                            size: 22, color: agSubtle),
                      ),
                      SizedBox(width: kSpace3),
                      Expanded(
                        child: Text(
                          'Manzillarni keyingi qadamda xaritadan tanlaysiz — '
                          'aniq narx masofaga qarab o\'sha yerda hisoblanadi.',
                          style: TextStyle(
                            fontSize: kFontCaption,
                            color: agSubtle,
                            fontWeight: FontWeight.w600,
                            height: 1.4,
                          ),
                        ),
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
