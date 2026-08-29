import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/checkout_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

// ============================================================================
// SAVAT — QATLAMLI YUZA + YARASHISH INVARIANTI.
//
// 1. QATLAM. Ekran foni `kSurface2`, ichidagi bloklar `AgSurfaceCard`
//    (oq, chegarasiz). Ilgari fon `agBg` edi va kartalar soya bilan
//    ajratilardi — super-app tilida ajratish SOYA emas, YUZA orqali
//    beriladi, aks holda savat ekrani yo'lovchi va haydovchi ekranlaridan
//    boshqa tilda gapiradi.
//
// 2. YARASHISH. Narx qatorlari BITTA ro'yxatdan chiziladi va o'sha
//    ro'yxatning yig'indisi "Jami" bilan solishtiriladi (`assert`).
//    Sabab: checkout'da paydo bo'ladigan kutilmagan haq — savat
//    tashlashning birinchi sababi. Kelajakda xizmat haqi qo'shilsa, u
//    `_priceLines` ga qo'shiladi va SHU ONDA ham ko'rinadi, ham
//    yig'indiga kiradi — ikkinchi joyda "unutib qoldirish" imkoni yo'q.
//
// ⚠️ HISOB O'ZGARMADI. `cartSubtotal` / `deliveryFee` / `cartTotal` —
// hammasi `SuperappProvider` dagi o'sha getterlar. Bu yerda faqat
// KO'RINISH va invariant tekshiruvi.
// ============================================================================

/// Ekran fonidan uzilib turadigan yuza — savat ichidagi barcha bloklar
/// shu ikkilikda (`kSurface2` fon + oq karta) yashaydi.
const Color _kScreenSurface = kSurface2;

class CartScreen extends StatelessWidget {
  const CartScreen({super.key, this.embedded = false});

  /// When hosted as a bottom-nav tab there's no back button.
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<SuperappProvider>();

    return Scaffold(
      backgroundColor: _kScreenSurface,
      body: Column(
        children: [
          AgHeader(
            title: 'Savat',
            onBack: embedded ? null : () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: provider.isCartEmpty
                ? const _EmptyCart()
                : _CartBody(provider: provider, embedded: embedded),
          ),
        ],
      ),
    );
  }
}

class _EmptyCart extends StatelessWidget {
  const _EmptyCart();

  @override
  Widget build(BuildContext context) {
    return AppEmptyState(
      icon: Icons.shopping_bag_outlined,
      title: "Savat bo'sh",
      message: "Ovqat yoki market mahsulotlarini qo'shing va bu yerda ko'rinadi.",
      actionLabel: "Bosh sahifaga o'tish",
      onAction: () {
        final provider = context.read<SuperappProvider>();
        if (provider.tabIndex != 0) provider.tabIndex = 0;
      },
    );
  }
}

/// Hisobning bitta tashkil etuvchisi. Ro'yxat sifatida saqlanadi, chunki
/// KO'RSATISH va QO'SHISH bitta manbadan bo'lishi shart.
@immutable
class _PriceLine {
  const _PriceLine(this.label, this.amount);
  final String label;
  final double amount;
}

class _CartBody extends StatelessWidget {
  const _CartBody({required this.provider, required this.embedded});
  final SuperappProvider provider;
  final bool embedded;

  @override
  Widget build(BuildContext context) {
    // Yo'lovchi ko'radigan HAR BIR haq shu ro'yxatda. Yashirin qator yo'q.
    final lines = <_PriceLine>[
      _PriceLine('Mahsulotlar', provider.cartSubtotal),
      _PriceLine('Yetkazib berish', provider.deliveryFee),
    ];
    final linesSum = lines.fold<double>(0, (sum, l) => sum + l.amount);
    final total = provider.cartTotal;

    // ⚠️ YARASHISH INVARIANTI. Faqat debug rejimida ishlaydi (relizda
    // olib tashlanadi), lekin ishlab chiqish paytida yangi haq qo'shib,
    // uni qatorlar ro'yxatiga kiritishni unutgan odamni SHU YERDA
    // to'xtatadi — yo'lovchi checkout'da hayron bo'lgunicha emas.
    assert(
      (linesSum - total).abs() < 0.01,
      "Savat yarashmadi: qatorlar yig'indisi $linesSum, jami $total. "
      "Yangi haq qo'shilgan bo'lsa, u `lines` ro'yxatiga ham kirishi shart.",
    );

    return Stack(
      children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, 180),
          children: [
            AgSurfaceCard(
              padding: const EdgeInsets.symmetric(horizontal: kSpace4),
              child: Column(
                children: [
                  for (var i = 0; i < provider.cart.length; i++)
                    _CartRow(
                      item: provider.cart[i],
                      last: i == provider.cart.length - 1,
                      onInc: () => provider.increment(provider.cart[i].id),
                      onDec: () => provider.decrement(provider.cart[i].id),
                    ),
                ],
              ),
            ),
            const SizedBox(height: kSpace4),
            AgSurfaceCard(
              child: Column(
                children: [
                  for (var i = 0; i < lines.length; i++) ...[
                    if (i > 0) const SizedBox(height: kSpace3),
                    _SummaryRow(
                      lines[i].label,
                      Formatters.formatSom(lines[i].amount),
                    ),
                  ],
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: kSpace3),
                    child: _DashedDivider(),
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Jami',
                          style: TextStyle(
                              fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                      Text(Formatters.formatSom(total),
                          style: const TextStyle(
                              fontWeight: FontWeight.w800, fontSize: kFontTitle, color: agText)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: kSpace3),
            // Ishonch qatori: yuqoridagi uchta raqam — yakuniy raqamlar.
            // Yetkazib berish haqi AYNAN shu yerda aytilgani uchun
            // checkout'da yangi raqam chiqmasligini ochiq yozamiz.
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: kSpace2),
              child: Text(
                "Rasmiylashtirishda qo'shimcha haq qo'shilmaydi.",
                style: TextStyle(
                  fontSize: kFontCaption,
                  color: kInkMuted,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        Positioned(
          left: kSpace4,
          right: kSpace4,
          bottom: (embedded ? 92 : MediaQuery.of(context).padding.bottom + kSpace4),
          child: AgPrimaryButton(
            // Summa CTA da TAKRORLANADI — bu bosishdan oldingi oxirgi
            // tasdiq. Yo'lovchi qancha to'lashini tugmadan uzoqlashmasdan
            // ko'radi.
            label: 'Rasmiylashtirish · ${Formatters.formatSom(total)}',
            semanticsLabel:
                'Rasmiylashtirish, jami ${Formatters.formatSom(total)}',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const CheckoutScreen()),
            ),
          ),
        ),
      ],
    );
  }
}

class _CartRow extends StatelessWidget {
  const _CartRow({required this.item, required this.last, required this.onInc, required this.onDec});
  final CartItem item;
  final bool last;
  final VoidCallback onInc;
  final VoidCallback onDec;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: kSpace2),
      decoration: BoxDecoration(
        border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: item.color,
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: Icon(item.icon, size: 26, color: agOnPrimary.withValues(alpha: 0.95)),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText)),
                const SizedBox(height: kSpace1),
                // Qator darajasidagi yarashish: dona narxi × miqdor ko'rinib
                // turadi, shuning uchun qator jami "qayerdandir" kelgan
                // raqam emas. Kichik yozuv `kInkMuted` (5.47:1) —
                // `kInkSubtle` yozuvda ishlatilmaydi.
                Text(
                  '${Formatters.formatSom(item.price)} × ${item.qty}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: kFontCaption,
                      color: kInkMuted),
                ),
              ],
            ),
          ),
          const SizedBox(width: kSpace2),
          Text(
            Formatters.formatSom(item.lineTotal),
            style: const TextStyle(
                fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText),
          ),
          const SizedBox(width: kSpace2),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: kSpace1),
            decoration: BoxDecoration(
              color: _kScreenSurface,
              borderRadius: BorderRadius.circular(kRadiusSm),
              // Boshqaruv elementi — WCAG 1.4.11 bo'yicha chegara 3:1 dan
              // past bo'lmasligi kerak, shuning uchun `kLineInteractive`.
              border: Border.all(color: kLineInteractive),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _QtyButton(
                  icon: Icons.remove_rounded,
                  color: agText,
                  semanticsLabel: 'Miqdorni kamaytirish',
                  onTap: onDec,
                ),
                Text('${item.qty}',
                    style: const TextStyle(
                        fontWeight: FontWeight.w800, fontSize: kFontBody, color: agText)),
                _QtyButton(
                  icon: Icons.add_rounded,
                  color: agGreenText,
                  semanticsLabel: 'Miqdorni oshirish',
                  onTap: onInc,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Savatdagi "+" / "−" tugmasi — vizual ikonka kichik bo'lsa ham
/// tegish maydoni har doim kamida `kMinTapTarget` (48dp).
class _QtyButton extends StatelessWidget {
  const _QtyButton({
    required this.icon,
    required this.color,
    required this.semanticsLabel,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String semanticsLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticsLabel,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(
            minWidth: kMinTapTarget,
            minHeight: kMinTapTarget,
          ),
          child: Icon(icon, size: 20, color: color),
        ),
      ),
    );
  }
}

class _SummaryRow extends StatelessWidget {
  const _SummaryRow(this.label, this.value);
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: kFontLabel, color: agSubtle, fontWeight: FontWeight.w600)),
        Text(value,
            style: const TextStyle(
                fontSize: kFontLabel, color: agText, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

class _DashedDivider extends StatelessWidget {
  const _DashedDivider();

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const dashWidth = 5.0;
        const dashSpace = 4.0;
        final count = (constraints.maxWidth / (dashWidth + dashSpace)).floor();
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: List.generate(
            count,
            (_) => Container(width: dashWidth, height: 1, color: agBorder),
          ),
        );
      },
    );
  }
}
