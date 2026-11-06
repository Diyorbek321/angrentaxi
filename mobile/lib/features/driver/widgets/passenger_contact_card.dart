import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/features/safety/call_relay.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:flutter/material.dart';

/// Yo'lovchi (yoki yetkazishda mijoz) ismi va qo'ng'iroq tugmasi.
///
/// ⚠️ NEGA OLIB KETISHGACHA HAM. Ilgari qo'ng'iroq faqat safar BOSHLANGACH
/// (`trip_screen`) chiqardi. Holbuki haydovchiga u eng ko'p yo'lovchini
/// kutayotganda kerak: manzil noaniq, yo'lovchi ko'rinmaydi, "qaysi
/// darvoza?" — navigatsiya va "Yetib keldim" ekranlarida.
///
/// Qo'ng'iroq ilova orqali (`callViaRelay`, INCIDENT-POLICY §4) — raqam
/// buyurtma javobida kelmaydi. Faol bo'lmagan buyurtmada tugma o'z joyida
/// qoladi, lekin o'chiq —
/// yo'qolib qolsa, tartib siljib, haydovchi boshqa narsani bosib yuborardi.
class PassengerContactCard extends StatelessWidget {
  const PassengerContactCard({
    super.key,
    required this.order,
    required this.wording,
  });

  final Order order;
  final DriverServiceWording wording;

  static const Key callButtonKey = ValueKey('passenger_contact_call');


  @override
  Widget build(BuildContext context) {
    final hasName = order.passengerName?.isNotEmpty == true;
    // Ism kelmasa sarlavhaning o'zi qoladi — "Yo'lovchi / Yo'lovchi" deb
    // ikki marta yozilmaydi.
    final name = hasName ? order.passengerName! : wording.clientLabel;
    // Raqam javobda kelmaydi — server faol buyurtmada beradi (§4).
    final canCall = order.callRelayOpen;

    return AgSurfaceCard(
      child: Row(
        children: [
          const ExcludeSemantics(
            child: CircleAvatar(
              radius: 20,
              backgroundColor: kSurface2,
              child: Icon(Icons.person_rounded, color: kInkMuted),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (hasName)
                  Text(
                    wording.clientLabel,
                    style: const TextStyle(color: kInkMuted, fontSize: kFontMicro),
                  ),
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: kFontBodyLg,
                    color: kInk,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: kSpace3),
          // Haydovchi ikkilamchi nishoni — 56dp (`kMinTapTargetDriver`).
          Semantics(
            button: true,
            enabled: canCall,
            label: context.l10n.drvCall,
            excludeSemantics: true,
            child: SizedBox.square(
              dimension: kMinTapTargetDriver,
              child: IconButton.filled(
                key: callButtonKey,
                onPressed: canCall ? () => callViaRelay(context, order.id) : null,
                style: IconButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: kOnPrimary,
                  disabledBackgroundColor: kSurface2,
                ),
                icon: const Icon(Icons.call_rounded),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
