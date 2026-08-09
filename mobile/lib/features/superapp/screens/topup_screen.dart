import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class TopUpScreen extends StatefulWidget {
  const TopUpScreen({super.key});

  @override
  State<TopUpScreen> createState() => _TopUpScreenState();
}

class _TopUpScreenState extends State<TopUpScreen> {
  static const _presets = [20000.0, 50000.0, 100000.0];
  static const String _supportPhone = '1056';

  double _amount = 50000;

  Future<void> _contactSupport(BuildContext context) async {
    final uri = Uri(scheme: 'tel', path: _supportPhone);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Qo\'ng\'iroq qilib bo\'lmadi — $_supportPhone raqamiga o\'zingiz qo\'ng\'iroq qiling'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agSurface,
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(kSpace4, MediaQuery.of(context).padding.top + kSpace3, kSpace4, kSpace2),
            child: Row(
              children: [
                AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop(), semanticsLabel: 'Orqaga'),
                const SizedBox(width: kSpace3),
                const Text('Hisobni to\'ldirish',
                    style: TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: kSpace4),
              children: [
                const SizedBox(height: kSpace5),
                const Center(
                  child: Text('To\'ldirish summasi',
                      style: TextStyle(fontSize: kFontLabel, color: agSubtle, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(height: kSpace1 + 2),
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(Formatters.formatAmount(_amount),
                          style: const TextStyle(fontSize: kFontDisplay, fontWeight: FontWeight.w800, color: agText, letterSpacing: -1.5)),
                      const SizedBox(width: kSpace2),
                      const Text("so'm", style: TextStyle(fontSize: kFontH2, color: agSubtle, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                const SizedBox(height: kSpace5),
                Row(
                  children: [
                    for (var i = 0; i < _presets.length; i++) ...[
                      if (i != 0) const SizedBox(width: kSpace3),
                      Expanded(
                        child: Builder(
                          builder: (context) {
                            final active = _amount == _presets[i];
                            return Semantics(
                              button: true,
                              selected: active,
                              label: Formatters.formatAmount(_presets[i]),
                              excludeSemantics: true,
                              child: GestureDetector(
                                onTap: () => setState(() => _amount = _presets[i]),
                                behavior: HitTestBehavior.opaque,
                                child: Container(
                                  constraints: const BoxConstraints(
                                    minHeight: kMinTapTarget,
                                    minWidth: kMinTapTarget,
                                  ),
                                  padding: const EdgeInsets.symmetric(vertical: kSpace3),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    // Faol chip — interaktiv to'ldirish
                                    // (`agPrimary` + oq yozuv, 5.38:1).
                                    color: active ? agPrimary : agBg,
                                    borderRadius: BorderRadius.circular(kRadiusSm),
                                    border: Border.all(
                                      color: active ? agPrimary : agBorder,
                                      width: 1.5,
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      if (active) ...[
                                        const ExcludeSemantics(
                                          child: Icon(Icons.check_rounded,
                                              size: 15, color: agOnPrimary),
                                        ),
                                        const SizedBox(width: kSpace1),
                                      ],
                                      Flexible(
                                        child: Text(
                                          Formatters.formatAmount(_presets[i]),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(
                                            fontWeight: FontWeight.w800,
                                            fontSize: kFontBody,
                                            color: active ? agOnPrimary : agText,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: kSpace6),
                // Online top-up needs a Payme/Click merchant agreement before
                // a card can be charged. Until that exists this screen states
                // the real options instead of showing a saved card that
                // belongs to nobody ("Uzcard 8600 •••• 4421") next to a button
                // that only re-read the balance and closed the screen.
                Container(
                  padding: const EdgeInsets.all(kSpace4),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agCardShadow,
                  ),
                  child: const Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          ExcludeSemantics(
                            child: Icon(Icons.info_outline_rounded,
                                size: 22, color: agSubtle),
                          ),
                          SizedBox(width: kSpace3),
                          Expanded(
                            child: Text(
                              'Onlayn to\'ldirish hali ishga tushmagan',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: kFontBody,
                                color: agText,
                              ),
                            ),
                          ),
                        ],
                      ),
                      SizedBox(height: kSpace2),
                      Text(
                        'Hozircha hamyonni operator orqali to\'ldirasiz: 1056 '
                        'raqamiga qo\'ng\'iroq qiling yoki chatda yozing. '
                        'Safarlarni naqd pul bilan ham to\'lash mumkin.',
                        style: TextStyle(
                          fontSize: kFontCaption,
                          color: agSubtle,
                          fontWeight: FontWeight.w600,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, MediaQuery.of(context).padding.bottom + kSpace5),
            child: AgPrimaryButton(
              label: 'Operator bilan bog\'lanish',
              onPressed: () => _contactSupport(context),
            ),
          ),
        ],
      ),
    );
  }
}
