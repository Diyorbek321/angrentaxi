import 'package:angren_taxi/core/config/payment_brand_colors.dart';
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
            padding: EdgeInsets.fromLTRB(kSpace4, MediaQuery.of(context).padding.top + kSpace3, kSpace4, kSpace2),
            child: Row(
              children: [
                AgIconButton(icon: Icons.arrow_back_rounded, onTap: () => Navigator.of(context).pop(), semanticsLabel: 'Orqaga'),
                const SizedBox(width: kSpace3),
                const Text("Karta qo'shish",
                    style: TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: agText)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace3, kSpace4, kSpace6),
              children: [
                Container(
                  height: 188,
                  padding: const EdgeInsets.all(kSpace5),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: kGradientInkColors,
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agInkShadow,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          ExcludeSemantics(
                            child: Container(
                              width: 42,
                              height: 30,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(colors: kCardChipGradient),
                                borderRadius: BorderRadius.circular(kRadiusXs),
                              ),
                            ),
                          ),
                          ExcludeSemantics(
                            child: Icon(
                              Icons.contactless_rounded,
                              color: agOnPrimary.withValues(alpha: 0.7),
                              size: 24,
                            ),
                          ),
                        ],
                      ),
                      const Text('8600 •••• •••• ••••',
                          style: TextStyle(color: agOnPrimary, fontSize: kFontH1, fontWeight: FontWeight.w700, letterSpacing: 3)),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('KARTA EGASI',
                              style: TextStyle(
                                  color: agOnPrimary.withValues(alpha: 0.8),
                                  fontSize: kFontLabel,
                                  fontWeight: FontWeight.w600)),
                          Text('MM/YY',
                              style: TextStyle(
                                  color: agOnPrimary.withValues(alpha: 0.8),
                                  fontSize: kFontLabel,
                                  fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: kSpace6),
                const _Field(label: 'Karta raqami', hint: '0000 0000 0000 0000'),
                const SizedBox(height: kSpace3),
                const Row(
                  children: [
                    Expanded(child: _Field(label: 'Amal qilish', hint: 'MM/YY')),
                    SizedBox(width: kSpace3),
                    Expanded(child: _Field(label: 'SMS kodi', hint: '— — — —')),
                  ],
                ),
                const SizedBox(height: kSpace6),
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
        Text(label, style: const TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w700, color: agSubtle)),
        const SizedBox(height: kSpace2),
        Container(
          height: kControlHeight,
          padding: const EdgeInsets.symmetric(horizontal: kSpace4),
          alignment: Alignment.centerLeft,
          decoration: BoxDecoration(
            color: agSurface,
            borderRadius: BorderRadius.circular(kRadiusMd),
            border: Border.all(color: agBorder, width: 1.5),
          ),
          child: Text(hint, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBodyLg, color: agSubtle)),
        ),
      ],
    );
  }
}
