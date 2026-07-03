import 'package:angren_taxi/features/superapp/screens/add_card_screen.dart';
import 'package:angren_taxi/features/superapp/screens/topup_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WalletScreen extends StatelessWidget {
  const WalletScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final balance = context.select<SuperappProvider, double>((p) => p.walletBalance);

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(title: 'Hamyon', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 18, 16, 24),
              children: [
                _BalanceCard(
                  balance: balance,
                  onTopUp: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const TopUpScreen()),
                  ),
                ),
                const SizedBox(height: 24),
                AgSectionTitle('Kartalar', trailing: '+ Qo\'shish', onTrailingTap: () {
                  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const AddCardScreen()));
                }),
                const SizedBox(height: 12),
                const _CardTile(
                  label: 'UZ',
                  gradient: [Color(0xFF1FA0E5), Color(0xFF0B6BB5)],
                  name: 'Uzcard',
                  number: '8600 •••• •••• 4421',
                  selected: true,
                ),
                const SizedBox(height: 11),
                const _CardTile(
                  label: 'HUMO',
                  gradient: [Color(0xFF34C759), Color(0xFF1E9E45)],
                  name: 'Humo',
                  number: '9860 •••• •••• 7702',
                ),
                const SizedBox(height: 22),
                const AgSectionTitle('So\'nggi amallar'),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 15),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(18),
                    boxShadow: agCardShadow,
                  ),
                  child: const Column(
                    children: [
                      _TxnRow(icon: Icons.add_rounded, iconColor: agGreen, title: 'Hisob to\'ldirildi', time: 'Bugun, 09:12', amount: '+50 000', amountColor: agGreen),
                      Divider(color: agDivider, height: 1),
                      _TxnRow(icon: Icons.local_taxi_rounded, iconColor: agSubtle, title: 'Taksi to\'lovi', time: 'Kecha, 18:24', amount: '−18 000', amountColor: agText, last: true),
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

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({required this.balance, required this.onTopUp});
  final double balance;
  final VoidCallback onTopUp;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [agInk, Color(0xFF1D3A2F)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.25), blurRadius: 40, offset: const Offset(0, 18))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Angren Go balans', style: TextStyle(color: Colors.white60, fontSize: 13, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(Formatters.formatAmount(balance),
                  style: const TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -1)),
              const SizedBox(width: 6),
              const Text("so'm", style: TextStyle(color: Colors.white70, fontSize: 18, fontWeight: FontWeight.w700)),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: onTopUp,
                  child: Container(
                    height: 46,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(color: agBright, borderRadius: BorderRadius.circular(13)),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.add_rounded, color: Color(0xFF06231A), size: 19),
                        SizedBox(width: 7),
                        Text("To'ldirish", style: TextStyle(color: Color(0xFF06231A), fontSize: 13.5, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Container(
                  height: 46,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.north_east_rounded, color: Colors.white, size: 19),
                      SizedBox(width: 7),
                      Text("O'tkazish", style: TextStyle(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w800)),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CardTile extends StatelessWidget {
  const _CardTile({
    required this.label,
    required this.gradient,
    required this.name,
    required this.number,
    this.selected = false,
  });

  final String label;
  final List<Color> gradient;
  final String name;
  final String number;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(18),
        boxShadow: agCardShadow,
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 33,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: gradient),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w800)),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText)),
                Text(number, style: const TextStyle(fontSize: 12.5, color: agMuted, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          if (selected)
            Container(
              width: 22,
              height: 22,
              decoration: const BoxDecoration(color: agTint, shape: BoxShape.circle),
              child: const Icon(Icons.check_rounded, size: 15, color: agGreen),
            ),
        ],
      ),
    );
  }
}

class _TxnRow extends StatelessWidget {
  const _TxnRow({
    required this.icon,
    required this.iconColor,
    required this.title,
    required this.time,
    required this.amount,
    required this.amountColor,
    this.last = false,
  });

  final IconData icon;
  final Color iconColor;
  final String title;
  final String time;
  final String amount;
  final Color amountColor;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(12)),
            child: Icon(icon, size: 21, color: iconColor),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5, color: agText)),
                Text(time, style: const TextStyle(fontSize: 11.5, color: agMuted, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Text(amount, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: amountColor)),
        ],
      ),
    );
  }
}
