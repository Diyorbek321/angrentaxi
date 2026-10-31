import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/widgets/delivery_info_card.dart' show DeliveryCardStage;
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/parcel_info.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Posilka haydovchiga: nima olib ketilayotgani va kimga topshiriladi.
///
/// Taklifda faqat buyum va o'lcham — haydovchi sig'dira olishini biladi.
/// Yetkazish bosqichida qabul qiluvchi va unga qo'ng'iroq tugmasi; PIN kodni
/// esa haydovchi hech qachon ko'rmaydi — uni qabul qiluvchidan so'raydi.
class ParcelInfoCard extends StatelessWidget {
  const ParcelInfoCard({
    super.key,
    required this.parcel,
    required this.stage,
    this.onCall,
  });

  final ParcelInfo parcel;
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
      messenger.showSnackBar(SnackBar(content: Text(failedText)));
    }
  }

  String _sizeLabel(BuildContext context) => switch (parcel.size) {
        kParcelSizeMedium => context.l10n.drvParcelSizeMedium,
        kParcelSizeLarge => context.l10n.drvParcelSizeLarge,
        _ => context.l10n.drvParcelSizeSmall,
      };

  @override
  Widget build(BuildContext context) {
    final showRecipient = stage == DeliveryCardStage.dropoff;
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
          Row(
            children: [
              const Icon(Icons.inventory_2_outlined, color: kInkMuted, size: 22),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  parcel.itemDescription,
                  style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w700, color: kInk),
                ),
              ),
              Text(
                _sizeLabel(context),
                style: const TextStyle(fontSize: kFontLabel, fontWeight: FontWeight.w700, color: kInkMuted),
              ),
            ],
          ),
          if (showRecipient) ...[
            const SizedBox(height: kSpace3),
            Row(
              children: [
                const Icon(Icons.person_outline, color: kInkMuted, size: 22),
                const SizedBox(width: kSpace2),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        parcel.recipientName ?? context.l10n.drvParcelRecipient,
                        style: const TextStyle(fontSize: kFontTitle, fontWeight: FontWeight.w700, color: kInk),
                      ),
                      Text(
                        Formatters.formatPhone(parcel.recipientPhone),
                        style: const TextStyle(fontSize: kFontLabel, color: kInkMuted),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: kMinTapTargetDriver,
                  height: kMinTapTargetDriver,
                  child: IconButton(
                    tooltip: context.l10n.drvCallRecipient,
                    onPressed: () => _dial(context, parcel.recipientPhone),
                    icon: const Icon(Icons.call, color: kPrimary),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
