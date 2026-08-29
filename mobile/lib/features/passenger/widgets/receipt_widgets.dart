import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/order_receipt.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter/material.dart';

// ============================================================================
// CHEK EKRANINING QURILISH BO'LAKLARI.
//
// NEGA ALOHIDA FAYL: `receipt_screen.dart` ning vazifasi — ma'lumot olish,
// holatlarni boshqarish va kartalarni tartiblash. Qator, nuqta, quti kabi
// mayda bo'laklar u yerda turganida fayl 900 qatordan oshib ketdi va
// ekranning asosiy mantig'i ko'rinmay qoldi.
// ============================================================================

// ---------------------------------------------------------------------------
// Qatorlar va kichik bo'laklar
// ---------------------------------------------------------------------------

/// Yorliq chapda, summa o'ng chetda.
///
/// NEGA `Spacer` EMAS, `Expanded`: `Spacer` ham flex bo'lgani uchun yorliq
/// bilan bo'sh joyni TENG bo'lishardi va "Masofa (7.4 km × 2 500 so'm)"
/// kabi uzun yorliq joy bo'lsa ham erta ko'chib ketardi. `Expanded` yorliqqa
/// butun bo'sh joyni beradi, summa esa baribir o'ng chetga yopishadi —
/// kerakli natija aynan shu.
class ReceiptAmountRow extends StatelessWidget {
  const ReceiptAmountRow({
    super.key,
    required this.label,
    required this.value,
    this.hint,
    this.emphasized = false,
    this.large = false,
    this.valueColor,
  });

  final String label;
  final String value;

  /// Yorliq ostidagi bir qatorlik izoh (masalan chaqim komissiyasizligi).
  final String? hint;

  final bool emphasized;
  final bool large;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final size = large ? kFontH3 : kFontBody;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: kSpace2),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: large ? kFontTitle : kFontBody,
                    color: emphasized ? agText : agSubtle,
                    fontWeight: emphasized ? FontWeight.w800 : FontWeight.w600,
                  ),
                ),
                if (hint != null)
                  Text(
                    hint!,
                    style: const TextStyle(
                      fontSize: kFontMicro,
                      color: agMuted,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: kSpace3),
          Text(
            value,
            textAlign: TextAlign.right,
            style: TextStyle(
              fontSize: size,
              color: valueColor ?? agText,
              fontWeight: emphasized ? FontWeight.w800 : FontWeight.w700,
              // Raqamlar qatorma-qator ustma-ust tushishi uchun bir xil
              // kenglikdagi raqam glifi.
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class ReceiptRoutePoint extends StatelessWidget {
  const ReceiptRoutePoint({
    super.key,
    required this.color,
    required this.label,
    required this.value,
  });

  final Color color;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(top: 5),
          child: ExcludeSemantics(
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
            ),
          ),
        ),
        const SizedBox(width: kSpace3),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: kFontMicro,
                  color: agSubtle,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                value,
                style: const TextStyle(
                  fontSize: kFontBody,
                  color: agText,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

enum ReceiptNoticeTone { info, warning }

/// Ma'lumot / ogohlantirish qutisi. Ma'no FAQAT rang bilan berilmaydi —
/// ikona va matn har doim birga keladi (WCAG 1.4.1).
class ReceiptNotice extends StatelessWidget {
  const ReceiptNotice({
    super.key,
    required this.icon,
    required this.text,
    this.tone = ReceiptNoticeTone.info,
  });

  final IconData icon;
  final String text;
  final ReceiptNoticeTone tone;

  @override
  Widget build(BuildContext context) {
    final isWarning = tone == ReceiptNoticeTone.warning;

    return Container(
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: isWarning ? kWarningLight : kSurface2,
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: isWarning ? kWarning : kLine),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Icon(
              icon,
              size: 20,
              color: isWarning ? kWarningDeep : agSubtle,
            ),
          ),
          const SizedBox(width: kSpace2),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: kFontLabel,
                color: isWarning ? kWarningDeep : agSubtle,
                fontWeight: FontWeight.w600,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ReceiptCard extends StatelessWidget {
  const ReceiptCard({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusLg),
        boxShadow: agCardShadow,
      ),
      child: child,
    );
  }
}

class ReceiptDivider extends StatelessWidget {
  const ReceiptDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: kSpace2),
      child: Divider(color: agDivider, height: 1),
    );
  }
}

// ---------------------------------------------------------------------------
// Yuklanish skeletoni
// ---------------------------------------------------------------------------

/// Chek shakliga MOS skeleton: sarlavha kartasi, marshrut, narx qatorlari.
/// Spinner emas — foydalanuvchi kutayotgan narsaning shaklini oldindan
/// ko'rsa, sahifa "sakramaydi".
class ReceiptSkeleton extends StatelessWidget {
  const ReceiptSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return AppSkeletonGroup(
      label: 'Chek yuklanmoqda',
      child: ListView(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace8),
        children: [
          _card([
            const Row(
              children: [
                AppSkeleton(width: 48, height: 48, radius: kRadiusMd),
                SizedBox(width: kSpace3),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    AppSkeleton(width: 96, height: 10),
                    SizedBox(height: kSpace2),
                    AppSkeleton(width: 140, height: 18),
                  ],
                ),
              ],
            ),
            const SizedBox(height: kSpace4),
            _row(),
            _row(),
          ]),
          const SizedBox(height: kSpace4),
          _card([
            const AppSkeleton(width: 200, height: 14),
            const SizedBox(height: kSpace4),
            const AppSkeleton(width: 170, height: 14),
          ]),
          const SizedBox(height: kSpace4),
          _card([
            const AppSkeleton(width: 110, height: 14),
            const SizedBox(height: kSpace4),
            _row(),
            _row(),
            _row(),
            _row(),
          ]),
        ],
      ),
    );
  }

  Widget _card(List<Widget> children) => Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(kRadiusLg),
          boxShadow: agCardShadow,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: children,
        ),
      );

  Widget _row() => const Padding(
        padding: EdgeInsets.symmetric(vertical: kSpace2),
        child: Row(
          children: [
            AppSkeleton(width: 120, height: 12),
            Spacer(),
            AppSkeleton(width: 76, height: 12),
          ],
        ),
      );
}

AppStatusTone receiptPaymentTone(ReceiptPaymentStatus status) => switch (status) {
      ReceiptPaymentStatus.completed => AppStatusTone.success,
      ReceiptPaymentStatus.pending => AppStatusTone.warning,
      ReceiptPaymentStatus.failed => AppStatusTone.danger,
      ReceiptPaymentStatus.refunded => AppStatusTone.neutral,
    };
