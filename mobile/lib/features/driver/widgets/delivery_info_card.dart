import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Kuryer safarining qaysi bosqichi — karta shunga qarab kerakli
/// telefonni ko'rsatadi: olishdan oldin restoran/do'kon, keyin mijoz.
enum DeliveryCardStage { offer, pickup, dropoff }

/// Ovqat/market kuryeriga "nima olib ketyapman va qancha pul olaman".
///
/// ⚠️ NAQD SUMMA ENG YUQORIDA va ogohlantirish rangida: taksi taklifida
/// ekrandagi eng katta raqam — daromad. Yetkazishda esa eshik oldida
/// mijozdan olinadigan pul undan ancha katta bo'lishi mumkin (butun savat),
/// va kuryer buni qabul qilishdan OLDIN bilishi shart.
class DeliveryInfoCard extends StatelessWidget {
  const DeliveryInfoCard({
    super.key,
    required this.delivery,
    required this.stage,
    this.onCall,
  });

  final DeliveryInfo delivery;
  final DeliveryCardStage stage;

  /// Testlar uchun almashtiriladi; standart — tizim `tel:` terish oynasi.
  final Future<void> Function(String phone)? onCall;

  Future<void> _dial(BuildContext context, String phone) async {
    if (onCall != null) return onCall!(phone);
    final uri = Uri(scheme: 'tel', path: phone);
    final messenger = ScaffoldMessenger.of(context);
    final failedText = context.l10n.drvCallFailed;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      messenger.showSnackBar(
        SnackBar(content: Text(failedText)),
      );
    }
  }

  String? get _phoneForStage => switch (stage) {
        DeliveryCardStage.offer => null,
        DeliveryCardStage.pickup => delivery.vendorPhone,
        DeliveryCardStage.dropoff => delivery.customerPhone,
      };

  @override
  Widget build(BuildContext context) {
    final phone = _phoneForStage;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Olishdan OLDIN: kuryer do'konga o'z pulidan to'laydi — buni
          // zakazni qabul qilishdan oldin bilishi shart (cho'ntagida
          // yetarli naqd bormi). Olgandan keyin bu qator kerak emas.
          if (delivery.mustPayVendor && stage != DeliveryCardStage.dropoff) ...[
            _PayVendorLine(amount: delivery.payVendor),
            const SizedBox(height: kSpace2),
          ],
          _CashBanner(delivery: delivery),
          const SizedBox(height: kSpace3),
          Row(
            children: [
              const Icon(Icons.storefront_outlined, color: kInkMuted, size: 22),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      delivery.vendorName.isEmpty
                          ? context.l10n.drvSeller
                          : delivery.vendorName,
                      style: const TextStyle(
                        fontSize: kFontTitle,
                        fontWeight: FontWeight.w700,
                        color: kInk,
                      ),
                    ),
                    if (delivery.itemsCount > 0)
                      Text(
                        context.l10n.drvItemsCount(delivery.itemsCount),
                        style: const TextStyle(
                          fontSize: kFontLabel,
                          color: kInkMuted,
                        ),
                      ),
                  ],
                ),
              ),
              if (phone != null)
                SizedBox(
                  width: kMinTapTargetDriver,
                  height: kMinTapTargetDriver,
                  child: IconButton(
                    tooltip: stage == DeliveryCardStage.pickup
                        ? context.l10n.drvCallSeller
                        : context.l10n.drvCallCustomer,
                    onPressed: () => _dial(context, phone),
                    icon: const Icon(Icons.call, color: kPrimary),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _PayVendorLine extends StatelessWidget {
  const _PayVendorLine({required this.amount});

  final int amount;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(kSpace3),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadiusSm),
          border: Border.all(color: kWarningDeep.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            const Icon(Icons.storefront_outlined, color: kWarningDeep),
            const SizedBox(width: kSpace2),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    context.l10n.drvPayVendor,
                    style: const TextStyle(
                      fontSize: kFontLabel,
                      color: kWarningDeep,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    Formatters.formatPrice(amount.toDouble()),
                    style: const TextStyle(
                      fontSize: kFontTitle,
                      fontWeight: FontWeight.w800,
                      color: kInk,
                    ),
                  ),
                  Text(
                    context.l10n.drvPayVendorHint,
                    style: const TextStyle(fontSize: kFontCaption, color: kInkMuted),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CashBanner extends StatelessWidget {
  const _CashBanner({required this.delivery});

  final DeliveryInfo delivery;

  @override
  Widget build(BuildContext context) {
    final mustCollect = delivery.mustCollectCash;
    return Semantics(
      container: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace3,
          vertical: kSpace3,
        ),
        decoration: BoxDecoration(
          color: mustCollect ? kWarningLight : kMintTint,
          borderRadius: BorderRadius.circular(kRadiusSm),
        ),
        child: Row(
          children: [
            Icon(
              mustCollect ? Icons.payments_outlined : Icons.credit_card,
              color: mustCollect ? kWarningDeep : kPrimary,
            ),
            const SizedBox(width: kSpace2),
            Expanded(
              child: mustCollect
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          context.l10n.drvCollectCash,
                          style: const TextStyle(
                            fontSize: kFontLabel,
                            color: kWarningDeep,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          Formatters.formatPrice(
                            delivery.collectCash.toDouble(),
                          ),
                          style: const TextStyle(
                            fontSize: kFontH2,
                            fontWeight: FontWeight.w800,
                            color: kInk,
                          ),
                        ),
                      ],
                    )
                  : Text(
                      context.l10n.drvPaidOnline,
                      style: const TextStyle(
                        fontSize: kFontBody,
                        fontWeight: FontWeight.w600,
                        color: kPrimary,
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
