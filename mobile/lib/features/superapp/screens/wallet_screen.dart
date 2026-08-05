import 'package:angren_taxi/core/config/payment_brand_colors.dart';
import 'package:angren_taxi/features/superapp/screens/add_card_screen.dart';
import 'package:angren_taxi/features/superapp/screens/topup_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  @override
  void initState() {
    super.initState();
    // Always re-read on open: the balance may have moved since the home tab
    // last fetched it (an order was paid, a withdrawal cleared, ...).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) context.read<SuperappProvider>().loadWalletBalance();
    });
  }

  @override
  Widget build(BuildContext context) {
    final superapp = context.watch<SuperappProvider>();
    final balance = superapp.walletBalance;
    final walletError = superapp.walletError;
    final loadingTxns = superapp.isWalletLoading && balance == null;

    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(title: 'Hamyon', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                kSpace4,
                kSpace5,
                kSpace4,
                kSpace6,
              ),
              children: [
                _BalanceCard(
                  balance: balance,
                  onTopUp: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(builder: (_) => const TopUpScreen()),
                  ),
                ),
                if (balance == null && walletError != null) ...[
                  const SizedBox(height: kSpace3),
                  // Matn o'zgarmaydi — faqat umumiy `InlineErrorWidget`
                  // ko'rinishiga (kErrorDeep matn, 6.47:1) o'tkazildi.
                  InlineErrorWidget(
                    message: walletError,
                    onRetry: () => superapp.loadWalletBalance(),
                  ),
                ],
                const SizedBox(height: kSpace6),
                AgSectionTitle('Kartalar', trailing: '+ Qo\'shish', onTrailingTap: () {
                  Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const AddCardScreen()));
                }),
                const SizedBox(height: kSpace3),
                const _CardTile(
                  label: 'UZ',
                  gradient: kBrandUzcardGradient,
                  labelColor: agOnPrimary,
                  name: 'Uzcard',
                  number: '8600 •••• •••• 4421',
                  selected: true,
                ),
                const SizedBox(height: kSpace3),
                const _CardTile(
                  label: 'HUMO',
                  // Dekorativ mint to'ldirish — ustidagi yozuv `agOnMint`
                  // (7.84:1). Oq yozuv mint ustida atigi 2.12:1 berardi.
                  gradient: [kMint, kMintDeep],
                  labelColor: agOnMint,
                  name: 'Humo',
                  number: '9860 •••• •••• 7702',
                ),
                const SizedBox(height: kSpace6),
                const AgSectionTitle('So\'nggi amallar'),
                const SizedBox(height: kSpace3),
                if (loadingTxns)
                  const AppSkeletonList(
                    itemCount: 3,
                    hasTrailing: true,
                    padding: EdgeInsets.zero,
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                    decoration: BoxDecoration(
                      color: agSurface,
                      borderRadius: BorderRadius.circular(kRadiusLg),
                      boxShadow: agCardShadow,
                    ),
                    child: const Column(
                      children: [
                        _TxnRow(icon: Icons.add_rounded, iconColor: agGreenText, title: 'Hisob to\'ldirildi', time: 'Bugun, 09:12', amount: '+50 000', amountColor: agGreenText),
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

  /// `null` while loading or after a failed load — shown as a placeholder so
  /// the passenger is never given a fabricated figure.
  final double? balance;
  final VoidCallback onTopUp;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: kGradientInkColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(kRadiusXl),
        boxShadow: agInkShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Angren Go balans',
            style: TextStyle(
              color: agOnPrimary.withValues(alpha: 0.75),
              fontSize: kFontLabel,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: kSpace1 + 2),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(balance == null ? '—' : Formatters.formatAmount(balance!),
                  style: const TextStyle(color: agOnPrimary, fontSize: kFontDisplay, fontWeight: FontWeight.w800, letterSpacing: -1)),
              const SizedBox(width: kSpace1 + 2),
              Text(
                "so'm",
                style: TextStyle(
                  color: agOnPrimary.withValues(alpha: 0.8),
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace5),
          Row(
            children: [
              Expanded(
                child: Semantics(
                  button: true,
                  label: "To'ldirish",
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: onTopUp,
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      constraints: const BoxConstraints(
                        minHeight: kMinTapTarget,
                        minWidth: kMinTapTarget,
                      ),
                      height: kControlHeightSm,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: agBright,
                        borderRadius: BorderRadius.circular(kRadiusSm),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          ExcludeSemantics(
                            child: Icon(Icons.add_rounded, color: agOnMint, size: 19),
                          ),
                          SizedBox(width: kSpace2),
                          Text("To'ldirish", style: TextStyle(color: agOnMint, fontSize: kFontLabel, fontWeight: FontWeight.w800)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Container(
                  constraints: const BoxConstraints(
                    minHeight: kMinTapTarget,
                    minWidth: kMinTapTarget,
                  ),
                  height: kControlHeightSm,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: agOnPrimary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(kRadiusSm),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ExcludeSemantics(
                        child: Icon(Icons.north_east_rounded, color: agOnPrimary, size: 19),
                      ),
                      SizedBox(width: kSpace2),
                      Text("O'tkazish", style: TextStyle(color: agOnPrimary, fontSize: kFontLabel, fontWeight: FontWeight.w800)),
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
    required this.labelColor,
    required this.name,
    required this.number,
    this.selected = false,
  });

  final String label;
  final List<Color> gradient;

  /// Brend gradienti ustidagi yozuv rangi — mint to'ldirishda `agOnMint`,
  /// to'q ko'k brend gradientida `agOnPrimary`.
  final Color labelColor;
  final String name;
  final String number;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusLg),
        boxShadow: agCardShadow,
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 48,
              height: 33,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: gradient),
                borderRadius: BorderRadius.circular(kRadiusXs),
              ),
              child: Text(label, style: TextStyle(color: labelColor, fontSize: kFontMicro, fontWeight: FontWeight.w800)),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText)),
                Text(number, style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          if (selected)
            Semantics(
              label: 'Tanlangan karta',
              child: Container(
                width: 22,
                height: 22,
                decoration: const BoxDecoration(color: agTint, shape: BoxShape.circle),
                // `agTint` yuzada ma'noli yashil — `kPrimary` (4.95:1).
                child: const Icon(Icons.check_rounded, size: 15, color: agPrimary),
              ),
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
      padding: const EdgeInsets.symmetric(vertical: kSpace3),
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(color: agBg, borderRadius: BorderRadius.circular(kRadiusSm)),
              child: Icon(icon, size: 21, color: iconColor),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText)),
                Text(time, style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          Text(amount, style: TextStyle(fontWeight: FontWeight.w800, fontSize: kFontBody, color: amountColor)),
        ],
      ),
    );
  }
}
