import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/intercity/data/intercity_repository.dart';
import 'package:angren_taxi/features/intercity/intercity_driver_policy.dart';
import 'package:angren_taxi/features/intercity/intercity_messages.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/screens/driver_intercity_trips_screen.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';

/// Haydovchi bosh ekranidagi "Shaharlararo qatnovlarim" kartasi.
///
/// ⚠️ O'ZI YUKLAYDI va flag o'chiq bo'lsa (yoki so'rov yiqilsa) UMUMAN
/// chizilmaydi: bosh ekran sheet'i kichik telefonda allaqachon to'la,
/// ishlamaydigan xizmat uchun joy olish — yolg'on signal. Xato bosh ekranni
/// buzmasligi kerak, shuning uchun u jim yutiladi.
///
/// Keyingi qatnov bo'lsa karta uni ko'rsatadi (yo'nalish, vaqt, band joylar)
/// — haydovchi "kim yozildi?" savoliga ekran ochmasdan javob oladi.
class IntercityDriverEntryCard extends StatefulWidget {
  const IntercityDriverEntryCard({
    super.key,
    this.repository,
    this.now,
    this.hasPassengersWaiting = false,
    this.spacingTop = 0,
  });

  final IntercityRepository? repository;
  final DateTime Function()? now;

  /// Faol band bor (DriverProvider.hasIntercityInFlight) — urg'u beriladi.
  final bool hasPassengersWaiting;

  /// Karta chizilgandagina qo'shiladigan yuqori oraliq.
  final double spacingTop;

  @override
  State<IntercityDriverEntryCard> createState() =>
      _IntercityDriverEntryCardState();
}

class _IntercityDriverEntryCardState extends State<IntercityDriverEntryCard> {
  late final IntercityRepository _repo =
      widget.repository ?? IntercityRepository();

  IntercityPublicSettings _settings = IntercityPublicSettings.disabled;
  IntercityTrip? _next;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final settings = await _repo.publicSettings();
      if (!settings.enabled) {
        if (mounted) setState(() => _settings = settings);
        return;
      }
      final trips = await _repo.myTrips();
      if (!mounted) return;
      setState(() {
        _settings = settings;
        _next = IntercityDriverTrips.split(trips).next;
      });
    } catch (e) {
      debugPrint('[IntercityDriverEntryCard] load failed: $e');
    }
  }

  Future<void> _open() async {
    await Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => DriverIntercityTripsScreen(
        repository: _repo,
        settings: _settings,
        now: widget.now,
      ),
    ));
    if (mounted) await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (!_settings.enabled) return const SizedBox.shrink();
    final l10n = context.l10n;
    final next = _next;
    final subtitle = widget.hasPassengersWaiting
        ? l10n.icDrvInFlight
        : next == null
            ? l10n.icDrvEntrySubtitle
            : '${intercityRouteLabel(next.originName, next.destinationName)}'
                ' · ${formatTashkentDayTime(next.departureAt)}';

    return Padding(
      padding: EdgeInsets.only(top: widget.spacingTop),
      child: _card(context, l10n, next, subtitle),
    );
  }

  Widget _card(
    BuildContext context,
    AppLocalizations l10n,
    IntercityTrip? next,
    String subtitle,
  ) {
    return AppPressable(
      key: const ValueKey('ic_driver_entry'),
      onTap: _open,
      semanticsLabel: l10n.icDrvEntryTitle,
      pressedScale: 0.98,
      minTapTarget: false,
      child: AgSurfaceCard(
        padding: const EdgeInsets.symmetric(
          horizontal: kSpace4,
          vertical: kSpace3,
        ),
        child: ExcludeSemantics(
          child: Row(
            children: [
              const SizedBox(
                width: 40,
                height: 40,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: kMintTint,
                    borderRadius: BorderRadius.all(Radius.circular(kRadiusSm)),
                  ),
                  child: Icon(Icons.route_rounded, size: 22, color: kInk),
                ),
              ),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      l10n.icDrvEntryTitle,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: kFontBodyLg,
                        fontWeight: FontWeight.w700,
                        color: kInk,
                      ),
                    ),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: kFontCaption,
                        color: widget.hasPassengersWaiting ? kInk : kInkMuted,
                        fontWeight: widget.hasPassengersWaiting
                            ? FontWeight.w700
                            : FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
              if (next != null) ...[
                const SizedBox(width: kSpace2),
                Text(
                  next.wholeCarBooked
                      ? l10n.icDrvWholeCarBooked
                      : l10n.icDrvSeatsTaken(next.seatsTaken, next.seatsTotal),
                  style: const TextStyle(
                    fontSize: kFontCaption,
                    fontWeight: FontWeight.w700,
                    color: kInk,
                  ),
                ),
              ],
              const Icon(Icons.chevron_right_rounded, color: kInkSubtle),
            ],
          ),
        ),
      ),
    );
  }
}
