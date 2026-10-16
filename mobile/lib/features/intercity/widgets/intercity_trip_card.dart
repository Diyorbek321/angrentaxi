import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

/// Qatnov kartasi — qidiruv ro'yxatida.
///
/// Tartib yo'lovchining savollari ketma-ketligida: QACHON (katta vaqt),
/// KIM va QANDAY MASHINA, NECHTA JOY, keyin NARX. Narx oxirida, chunki
/// bir yo'nalishda u deyarli bir xil — yo'lovchi vaqt bo'yicha tanlaydi.
class IntercityTripCard extends StatelessWidget {
  const IntercityTripCard({super.key, required this.trip, this.onTap});

  final IntercityTrip trip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final driver = trip.driver;
    final car = [driver?.carModel, driver?.plate]
        .whereType<String>()
        .join(' · ');
    final bookable = trip.isBookable;

    return AppPressable(
      onTap: bookable ? onTap : null,
      child: Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(agRadiusMd),
          border: Border.all(color: agBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  formatTashkentTime(trip.departureAt),
                  style: const TextStyle(
                    fontSize: kFontH1,
                    fontWeight: FontWeight.w800,
                    color: agText,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(width: kSpace3),
                _ClassBadge(comfort: trip.isComfort),
                const Spacer(),
                Flexible(
                  child: Text(
                    trip.seatsLeft > 0
                        ? l10n.icSeatsLeft(trip.seatsLeft)
                        : l10n.icNoSeatsLeft,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w700,
                      color: trip.seatsLeft > 0 ? agGreenText : agSubtle,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: kSpace2),
            Row(
              children: [
                const Icon(Icons.person_rounded, size: 18, color: agSubtle),
                const SizedBox(width: kSpace1),
                Flexible(
                  child: Text(
                    driver?.firstName ?? l10n.icDriverUnknown,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: kFontBody,
                      fontWeight: FontWeight.w600,
                      color: agText,
                    ),
                  ),
                ),
                if (driver != null && driver.rating > 0) ...[
                  const SizedBox(width: kSpace2),
                  const Icon(Icons.star_rounded, size: 16, color: agOrange),
                  Text(
                    driver.rating.toStringAsFixed(1),
                    style: const TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w700,
                      color: agText,
                    ),
                  ),
                ],
              ],
            ),
            if (car.isNotEmpty) ...[
              const SizedBox(height: kSpace1),
              Text(
                car,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: kFontLabel, color: agSubtle),
              ),
            ],
            const SizedBox(height: kSpace3),
            Text(
              l10n.icSeatPrice(Formatters.formatPrice(trip.seatPrice)),
              style: const TextStyle(
                fontSize: kFontBody,
                fontWeight: FontWeight.w800,
                color: agText,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              trip.wholeCarAvailable
                  ? l10n.icWholeCarPrice(
                      Formatters.formatPrice(trip.wholeCarPrice))
                  : l10n.icWholeCarUnavailable,
              style: TextStyle(
                fontSize: kFontLabel,
                color: trip.wholeCarAvailable ? agSubtle : agMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ClassBadge extends StatelessWidget {
  const _ClassBadge({required this.comfort});

  final bool comfort;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: kSpace2, vertical: 2),
      decoration: BoxDecoration(
        color: comfort ? agInk : agTint,
        borderRadius: BorderRadius.circular(kRadiusFull),
      ),
      child: Text(
        intercityClassLabel(
          comfort ? IntercityTripClass.comfort : IntercityTripClass.start,
        ),
        style: TextStyle(
          fontSize: kFontCaption,
          fontWeight: FontWeight.w800,
          color: comfort ? agOnPrimary : agGreenText,
        ),
      ),
    );
  }
}
