import 'dart:async';

import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class TopUpScreen extends StatefulWidget {
  const TopUpScreen({super.key});

  @override
  State<TopUpScreen> createState() => _TopUpScreenState();
}

class _TopUpScreenState extends State<TopUpScreen> {
  static const _presets = [20000.0, 50000.0, 100000.0];
  double _amount = 50000;

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
                const Text('Hisobni to\'ldirish',
                    style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: agText)),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 18),
              children: [
                const SizedBox(height: 20),
                const Center(
                  child: Text('To\'ldirish summasi',
                      style: TextStyle(fontSize: 13, color: agSubtle, fontWeight: FontWeight.w700)),
                ),
                const SizedBox(height: 6),
                Center(
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(Formatters.formatAmount(_amount),
                          style: const TextStyle(fontSize: 42, fontWeight: FontWeight.w800, color: agText, letterSpacing: -1.5)),
                      const SizedBox(width: 8),
                      const Text("so'm", style: TextStyle(fontSize: 20, color: agMuted, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    for (var i = 0; i < _presets.length; i++) ...[
                      if (i != 0) const SizedBox(width: 10),
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _amount = _presets[i]),
                          child: Container(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: _amount == _presets[i] ? agTint : agBg,
                              borderRadius: BorderRadius.circular(13),
                              border: Border.all(
                                color: _amount == _presets[i] ? agMint : Colors.transparent,
                                width: 1.5,
                              ),
                            ),
                            child: Text(
                              Formatters.formatAmount(_presets[i]),
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                                color: _amount == _presets[i] ? agGreen : agText,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 22),
                Container(
                  padding: const EdgeInsets.all(15),
                  decoration: BoxDecoration(color: const Color(0xFFF8FAFB), borderRadius: BorderRadius.circular(16)),
                  child: Row(
                    children: [
                      Container(
                        width: 48,
                        height: 33,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(colors: [Color(0xFF1FA0E5), Color(0xFF0B6BB5)]),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('UZ', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w800)),
                      ),
                      const SizedBox(width: 13),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Uzcard', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText)),
                            Text('8600 •••• 4421', style: TextStyle(fontSize: 12.5, color: agMuted, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      const Icon(Icons.expand_more_rounded, color: agMuted, size: 20),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(18, 0, 18, MediaQuery.of(context).padding.bottom + 18),
            child: AgPrimaryButton(
              label: '${Formatters.formatSom(_amount)} to\'ldirish',
              onPressed: () {
                // There is no server-side top-up endpoint yet, so we must not
                // fake a locally incremented balance. Re-read the authoritative
                // balance from the backend instead — whatever it really is.
                unawaited(context.read<SuperappProvider>().loadWalletBalance());
                Navigator.of(context).pop();
              },
            ),
          ),
        ],
      ),
    );
  }
}
