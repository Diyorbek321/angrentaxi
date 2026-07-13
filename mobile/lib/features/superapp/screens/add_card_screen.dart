import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';

class AddCardScreen extends StatelessWidget {
  const AddCardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agSurface,
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.fromLTRB(16, MediaQuery.of(context).padding.top + 12, 16, 8),
            child: Row(
              children: [
                AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop()),
                const SizedBox(width: 12),
                const Text("Karta qo'shish",
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: agText)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(18, 14, 18, 24),
              children: [
                Container(
                  height: 188,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [agInk, Color(0xFF23413A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(22),
                    boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.22), blurRadius: 40, offset: const Offset(0, 18))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            width: 42,
                            height: 30,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(colors: [Color(0xFFF4D04A), Color(0xFFD4A82B)]),
                              borderRadius: BorderRadius.circular(7),
                            ),
                          ),
                          Icon(Icons.contactless_rounded, color: Colors.white.withValues(alpha: 0.7), size: 24),
                        ],
                      ),
                      const Text('8600 •••• •••• ••••',
                          style: TextStyle(color: Colors.white, fontSize: 21, fontWeight: FontWeight.w700, letterSpacing: 3)),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('KARTA EGASI', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
                          Text('MM/YY', style: TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 22),
                const _Field(label: 'Karta raqami', hint: '0000 0000 0000 0000'),
                const SizedBox(height: 13),
                const Row(
                  children: [
                    Expanded(child: _Field(label: 'Amal qilish', hint: 'MM/YY')),
                    SizedBox(width: 12),
                    Expanded(child: _Field(label: 'SMS kodi', hint: '— — — —')),
                  ],
                ),
                const SizedBox(height: 24),
                AgPrimaryButton(
                  label: 'Kartani saqlash',
                  // Card fields above are visual only (no controllers, no
                  // validation) and there is no backend endpoint for saving
                  // a tokenized card yet — Payme/Click card binding needs an
                  // SMS-verified round trip that hasn't been built. Popping
                  // silently here would tell the user their card was saved
                  // when nothing happened; show that honestly instead.
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          "Karta qo'shish tez kunda ishga tushadi. "
                          "Hozircha to'lovni buyurtma yakunida naqd yoki "
                          "onlayn (Payme/Click) amalga oshirishingiz mumkin.",
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  const _Field({required this.label, required this.hint});
  final String label;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: agSubtle)),
        const SizedBox(height: 7),
        Container(
          height: 52,
          padding: const EdgeInsets.symmetric(horizontal: 15),
          alignment: Alignment.centerLeft,
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: agBorder, width: 1.5),
          ),
          child: Text(hint, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: agMuted)),
        ),
      ],
    );
  }
}
