import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/support/screens/chat_screen.dart';
import 'package:flutter/material.dart';

class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  static const _faqs = [
    (Icons.help_outline_rounded, 'Buyurtmani qanday bekor qilaman?'),
    (Icons.payments_rounded, "To'lov o'tmadi, nima qilaman?"),
    (Icons.luggage_rounded, 'Mashinada narsa qoldirdim'),
    (Icons.star_rounded, 'Haydovchi ustidan shikoyat'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
              title: 'Yordam markazi',
              onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
              children: [
                Semantics(
                  button: true,
                  label: 'Operator bilan chat',
                  excludeSemantics: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(builder: (_) => const ChatScreen()),
                    ),
                    child: Container(
                      constraints: const BoxConstraints(minHeight: kMinTapTarget),
                      padding: const EdgeInsets.all(kSpace4),
                      decoration: BoxDecoration(
                        gradient: agCta,
                        borderRadius: BorderRadius.circular(kRadiusLg),
                        boxShadow: agCtaShadow,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 50,
                            height: 50,
                            decoration: BoxDecoration(
                                color: agOnPrimary.withValues(alpha: 0.22),
                                borderRadius: BorderRadius.circular(kRadiusMd)),
                            child: const Icon(Icons.forum_rounded,
                                color: agOnPrimary, size: 27),
                          ),
                          const SizedBox(width: kSpace3),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Operator bilan chat',
                                    style: TextStyle(
                                        color: agOnPrimary,
                                        fontWeight: FontWeight.w800,
                                        fontSize: kFontTitle)),
                                Text("O'rtacha javob · 2 daqiqa",
                                    style: TextStyle(
                                        color: agOnPrimary.withValues(alpha: 0.8),
                                        fontSize: kFontCaption,
                                        fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                          const Icon(Icons.arrow_forward_rounded,
                              color: agOnPrimary, size: 24),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: kSpace3),
                const Row(
                  children: [
                    Expanded(
                        child: _QuickCard(
                            icon: Icons.call_rounded,
                            bg: agTint,
                            // `agTint` yuzada ma'noli yashil — `agPrimary`.
                            color: agPrimary,
                            title: "Qo'ng'iroq",
                            sub: '1056 · bepul')),
                    SizedBox(width: kSpace3),
                    Expanded(
                        child: _QuickCard(
                            icon: Icons.send_rounded,
                            bg: kInfoLight,
                            color: kInfoDeep,
                            title: 'Telegram',
                            sub: '@AngrenGoBot')),
                  ],
                ),
                const SizedBox(height: kSpace6),
                const Text('Tez-tez beriladigan savollar',
                    style: TextStyle(
                        fontSize: kFontH3,
                        fontWeight: FontWeight.w800,
                        color: agText)),
                const SizedBox(height: kSpace3),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      for (var i = 0; i < _faqs.length; i++)
                        Container(
                          constraints:
                              const BoxConstraints(minHeight: kMinTapTarget),
                          padding: const EdgeInsets.symmetric(vertical: kSpace4),
                          decoration: BoxDecoration(
                            border: i == _faqs.length - 1
                                ? null
                                : const Border(
                                    bottom: BorderSide(color: agDivider)),
                          ),
                          child: Row(
                            children: [
                              ExcludeSemantics(
                                child: Icon(_faqs[i].$1,
                                    size: 22, color: agSubtle),
                              ),
                              const SizedBox(width: kSpace3),
                              Expanded(
                                child: Text(_faqs[i].$2,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: kFontBody,
                                        color: agText)),
                              ),
                              const ExcludeSemantics(
                                child: Icon(Icons.expand_more_rounded,
                                    size: 20, color: agSubtle),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickCard extends StatelessWidget {
  const _QuickCard(
      {required this.icon,
      required this.bg,
      required this.color,
      required this.title,
      required this.sub});
  final IconData icon;
  final Color bg;
  final Color color;
  final String title;
  final String sub;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: kMinTapTarget),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusLg),
        boxShadow: agCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                  color: bg, borderRadius: BorderRadius.circular(kRadiusSm)),
              child: Icon(icon, color: color, size: 24),
            ),
          ),
          const SizedBox(height: kSpace2),
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: kFontBody,
                  color: agText)),
          Text(sub,
              style: const TextStyle(
                  fontSize: kFontCaption,
                  color: agSubtle,
                  fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
