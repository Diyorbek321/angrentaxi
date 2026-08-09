import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/features/support/screens/chat_screen.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Support hub. The contact cards and the FAQ list used to be inert: the
/// phone and Telegram tiles had no tap handler at all, and every FAQ row
/// showed an expand chevron that opened nothing.
class SupportScreen extends StatelessWidget {
  const SupportScreen({super.key});

  static const String _supportPhone = '1056';
  static const String _telegramHandle = 'AngrenGoBot';

  static Future<void> _launch(
    BuildContext context,
    Uri uri,
    String failureMessage,
  ) async {
    // Requires the matching <intent> entries in AndroidManifest's
    // <queries> block, otherwise canLaunchUrl always answers false on
    // Android 11+.
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else if (context.mounted) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(failureMessage)));
    }
  }

  static const _faqs = [
    (
      Icons.help_outline_rounded,
      'Buyurtmani qanday bekor qilaman?',
      'Faol buyurtma ekranida "Bekor qilish" tugmasini bosing va sababni '
          'tanlang. Haydovchi yetib kelgunga qadar bekor qilish bepul.',
    ),
    (
      Icons.payments_rounded,
      "To'lov o'tmadi, nima qilaman?",
      'Hamyon balansingizni tekshiring. Balans yetmasa safar qarz sifatida '
          'qayd etiladi va uni to\'lamaguningizcha yangi buyurtma bera '
          'olmaysiz. Naqd to\'lovni tanlab ham davom etishingiz mumkin.',
    ),
    (
      Icons.luggage_rounded,
      'Mashinada narsa qoldirdim',
      'Buyurtmalar tarixidan safarni oching va haydovchiga qo\'ng\'iroq '
          'qiling. Javob bo\'lmasa, operator bilan chatga yozing — biz '
          'haydovchi bilan bog\'lanamiz.',
    ),
    (
      Icons.star_rounded,
      'Haydovchi ustidan shikoyat',
      'Safar tugagach baho qo\'yish ekranida izoh qoldiring yoki operator '
          'bilan chatga safar raqamini yuboring. Har bir shikoyat ko\'rib '
          'chiqiladi.',
    ),
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
                                Text('Savolingizni yozing — operator javob beradi',
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
                Row(
                  children: [
                    Expanded(
                        child: _QuickCard(
                            icon: Icons.call_rounded,
                            bg: agTint,
                            // `agTint` yuzada ma'noli yashil — `agPrimary`.
                            color: agPrimary,
                            title: "Qo'ng'iroq",
                            sub: '$_supportPhone · bepul',
                            onTap: () => _launch(
                                  context,
                                  Uri(scheme: 'tel', path: _supportPhone),
                                  'Qo\'ng\'iroq qilib bo\'lmadi',
                                ))),
                    const SizedBox(width: kSpace3),
                    Expanded(
                        child: _QuickCard(
                            icon: Icons.send_rounded,
                            bg: kInfoLight,
                            color: kInfoDeep,
                            title: 'Telegram',
                            sub: '@$_telegramHandle',
                            onTap: () => _launch(
                                  context,
                                  Uri.parse('https://t.me/$_telegramHandle'),
                                  'Telegramni ochib bo\'lmadi',
                                ))),
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
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      for (var i = 0; i < _faqs.length; i++)
                        _FaqTile(
                          icon: _faqs[i].$1,
                          question: _faqs[i].$2,
                          answer: _faqs[i].$3,
                          last: i == _faqs.length - 1,
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
      required this.sub,
      required this.onTap});
  final IconData icon;
  final Color bg;
  final Color color;
  final String title;
  final String sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: '$title, $sub',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
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
        ),
      ),
    );
  }
}

/// One expandable FAQ entry. Uses ExpansionTile so the chevron the design
/// already showed actually does something.
class _FaqTile extends StatelessWidget {
  const _FaqTile({
    required this.icon,
    required this.question,
    required this.answer,
    required this.last,
  });

  final IconData icon;
  final String question;
  final String answer;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
      ),
      child: Theme(
        // ExpansionTile draws its own divider lines; the card already has them.
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: kSpace4),
          childrenPadding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
          expandedCrossAxisAlignment: CrossAxisAlignment.start,
          leading: ExcludeSemantics(child: Icon(icon, size: 22, color: agSubtle)),
          title: Text(
            question,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: kFontBody,
              color: agText,
            ),
          ),
          children: [
            Text(
              answer,
              style: const TextStyle(
                fontSize: kFontCaption,
                color: agSubtle,
                fontWeight: FontWeight.w600,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
