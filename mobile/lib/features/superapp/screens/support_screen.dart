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
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                GestureDetector(
                  onTap: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const ChatScreen()),
                  ),
                  child: Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(
                      gradient: agCta,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                            color: agGreen.withValues(alpha: 0.28),
                            blurRadius: 32,
                            offset: const Offset(0, 14))
                      ],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.22),
                              borderRadius: BorderRadius.circular(15)),
                          child: const Icon(Icons.forum_rounded,
                              color: Colors.white, size: 27),
                        ),
                        const SizedBox(width: 14),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Operator bilan chat',
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 16)),
                              Text("O'rtacha javob · 2 daqiqa",
                                  style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_rounded,
                            color: Colors.white, size: 24),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                const Row(
                  children: [
                    Expanded(
                        child: _QuickCard(
                            icon: Icons.call_rounded,
                            bg: agTint,
                            color: agGreen,
                            title: "Qo'ng'iroq",
                            sub: '1056 · bepul')),
                    SizedBox(width: 12),
                    Expanded(
                        child: _QuickCard(
                            icon: Icons.send_rounded,
                            bg: Color(0xFFEFF6FF),
                            color: agBlue,
                            title: 'Telegram',
                            sub: '@AngrenGoBot')),
                  ],
                ),
                const SizedBox(height: 22),
                const Text('Tez-tez beriladigan savollar',
                    style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: agText)),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      for (var i = 0; i < _faqs.length; i++)
                        Container(
                          padding: const EdgeInsets.symmetric(vertical: 15),
                          decoration: BoxDecoration(
                            border: i == _faqs.length - 1
                                ? null
                                : const Border(
                                    bottom: BorderSide(color: agDivider)),
                          ),
                          child: Row(
                            children: [
                              Icon(_faqs[i].$1, size: 22, color: agSubtle),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(_faqs[i].$2,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 14,
                                        color: agText)),
                              ),
                              const Icon(Icons.expand_more_rounded,
                                  size: 20, color: Color(0xFFC2CCD4)),
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: agCardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
                color: bg, borderRadius: BorderRadius.circular(13)),
            child: Icon(icon, color: color, size: 24),
          ),
          const SizedBox(height: 10),
          Text(title,
              style: const TextStyle(
                  fontWeight: FontWeight.w800, fontSize: 14, color: agText)),
          Text(sub,
              style: const TextStyle(
                  fontSize: 12, color: agSubtle, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
