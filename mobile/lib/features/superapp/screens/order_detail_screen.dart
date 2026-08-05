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
            trailing: const AgIconButton(icon: Icons.ios_share_rounded, onTap: _noop, color: agSubtle, semanticsLabel: 'Ulashish'),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
              children: [
                _card(
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(color: agTint, borderRadius: BorderRadius.circular(kRadiusMd)),
                        child: const ExcludeSemantics(
                          child: Icon(Icons.check_circle_rounded, color: agGreenText, size: 25),
                        ),
                      ),
                      const SizedBox(width: kSpace3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(order.status, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                            const Text('Buyurtma muvaffaqiyatli bajarildi',
                                style: TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      const SizedBox(width: kSpace2),
                      Text(Formatters.formatSom(order.amount),
                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontH2, color: agText)),
                    ],
                  ),
                ),
                const SizedBox(height: kSpace4),
                _card(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      ExcludeSemantics(
                        child: Column(
                          children: [
                            const SizedBox(height: kSpace1),
                            Container(width: 11, height: 11, decoration: const BoxDecoration(color: kMintDeep, shape: BoxShape.circle)),
                            Expanded(child: Container(width: 2, color: agBorder, margin: const EdgeInsets.symmetric(vertical: kSpace1))),
                            Container(width: 11, height: 11, decoration: BoxDecoration(color: agRed, borderRadius: BorderRadius.circular(kRadiusXs))),
                            const SizedBox(height: kSpace1),
                          ],
                        ),
                      ),
                      const SizedBox(width: kSpace3),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _addr('QAYERDAN', order.from),
                            const Divider(color: agDivider, height: kSpace6),
                            _addr('QAYERGA', order.to),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                if (_isTaxi) ...[
                  const SizedBox(height: kSpace4),
                  _card(
                    child: Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          decoration: const BoxDecoration(
                            gradient: agMintGradient,
                            shape: BoxShape.circle,
                          ),
                          child: const Text('B', style: TextStyle(color: agOnMint, fontWeight: FontWeight.w800, fontSize: kFontH2)),
                        ),
                        const SizedBox(width: kSpace3),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Bobur A.', style: TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                              Row(
                                children: [
                                  ExcludeSemantics(
                                    child: Icon(Icons.star_rounded, size: 14, color: agOrange),
                                  ),
                                  SizedBox(width: kSpace1),
                                  Text('4.9 · Cobalt · 01 A 777 BB',
                                      style: TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
                                ],
                              ),
                            ],
                          ),
                        ),
                        const AgIconButton(icon: Icons.call_rounded, onTap: _noop, color: agSubtle, semanticsLabel: "Qo'ng'iroq qilish"),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: kSpace4),
                _card(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text("To'lov tafsiloti", style: TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                      const SizedBox(height: kSpace4),
                      _payRow('Asosiy summa', Formatters.formatSom(base)),
                      const SizedBox(height: kSpace3),
                      _payRow(_isTaxi ? 'Xizmat haqi' : 'Yetkazib berish', Formatters.formatSom(fee)),
                      const Padding(padding: EdgeInsets.symmetric(vertical: kSpace3), child: Divider(color: agBorder, height: 1)),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Jami', style: TextStyle(fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                          Text(Formatters.formatSom(order.amount),
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: kSpace4),
                Row(
                  children: [
                    Expanded(
                      child: Container(
                        height: kControlHeight,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: agSurface,
                          borderRadius: BorderRadius.circular(kRadiusMd),
                          border: Border.all(color: agBorder),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.help_outline_rounded, size: 20, color: agSubtle),
                            SizedBox(width: kSpace2),
                            Text('Yordam', style: TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(width: kSpace3),
                    Expanded(
                      flex: 14,
                      child: Semantics(
                        button: true,
                        label: 'Takrorlash',
                        excludeSemantics: true,
                        child: GestureDetector(
                          onTap: () => Navigator.of(context).pop(),
                          behavior: HitTestBehavior.opaque,
                          child: Container(
                            height: kControlHeight,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              gradient: agCta,
                              borderRadius: BorderRadius.circular(kRadiusMd),
                              boxShadow: agCtaShadow,
                            ),
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.replay_rounded, size: 20, color: agOnPrimary),
                                SizedBox(width: kSpace2),
                                Text('Takrorlash', style: TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: agOnPrimary)),
                              ],
                            ),
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
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(kRadiusLg),
          boxShadow: agCardShadow,
        ),
        child: child,
      );

  Widget _addr(String label, String value) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText)),
        ],
      );

  Widget _payRow(String label, String value) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: kFontLabel, color: agSubtle, fontWeight: FontWeight.w600)),
          Text(value, style: const TextStyle(fontSize: kFontLabel, color: agText, fontWeight: FontWeight.w700)),
        ],
      );
}
