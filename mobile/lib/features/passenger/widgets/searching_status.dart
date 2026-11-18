import 'dart:async';

import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// "Haydovchi izlanmoqda" holatining kartasi.
///
/// ⚠️ NEGA SPINNER EMAS. Kutish — yo'lovchi eng ko'p vaqt o'tkazadigan
/// holat, va oddiy aylanuvchi belgi faqat "ilova tirik" deydi. Bu karta
/// "ish ketyapti" deydi: o'tgan vaqt, matching bosqichiga mos o'zgaruvchi
/// izoh (server radiusni 2 → 3 → 5 km kengaytiradi) va atrofdagi BO'SH
/// haydovchilar soni. O'zgarib turgan matn tizim harakatda ekanini isbotlaydi.
///
/// Siyrak Angrenda "topilmadi" tez-tez bo'ladi — shuning uchun bir daqiqadan
/// keyin matn rostini aytadi ("hamma band — izlashda davom etamiz"), sukut
/// saqlamaydi.
class SearchingStatusCard extends StatefulWidget {
  const SearchingStatusCard({
    super.key,
    required this.startedAt,
    required this.nearbyFreeDrivers,
    this.onRefreshNearby,
    this.clock = DateTime.now,
  });

  /// Qidiruv boshlangan payt (`OrderProvider.searchStartedAt`); `null` —
  /// noma'lum, vaqt ko'rsatilmaydi.
  final DateTime? startedAt;

  /// Bo'sh haydovchilar soni; `null` — noma'lum (eski server), qator yo'q.
  final int? nearbyFreeDrivers;

  /// Sonni yangilash (darhol va har [nearbyRefreshInterval] da).
  final VoidCallback? onRefreshNearby;

  final DateTime Function() clock;

  static const Duration nearbyRefreshInterval = Duration(seconds: 15);

  /// Matching bosqichlari bilan mos: dastlabki partiya (2 km) va kengayish.
  static const Duration widenAfter = Duration(seconds: 20);
  static const Duration busyAfter = Duration(seconds: 60);

  /// "Ko'p" chegarasi — server son 10 bilan cheklangan.
  static const int manyThreshold = 10;

  @override
  State<SearchingStatusCard> createState() => _SearchingStatusCardState();
}

class _SearchingStatusCardState extends State<SearchingStatusCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  );
  Timer? _ticker;
  Timer? _nearbyTimer;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    widget.onRefreshNearby?.call();
    _nearbyTimer = Timer.periodic(
      SearchingStatusCard.nearbyRefreshInterval,
      (_) => widget.onRefreshNearby?.call(),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Harakatni kamaytirish yoqilgan bo'lsa — pulsatsiya to'xtaydi, radar
    // statik halqa bo'lib qoladi (ma'no saqlanadi).
    if (AppMotion.reduced(context)) {
      _pulse.stop();
    } else if (!_pulse.isAnimating) {
      _pulse.repeat();
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _nearbyTimer?.cancel();
    _pulse.dispose();
    super.dispose();
  }

  Duration get _elapsed {
    final start = widget.startedAt;
    if (start == null) return Duration.zero;
    final elapsed = widget.clock().difference(start);
    return elapsed.isNegative ? Duration.zero : elapsed;
  }

  static String _clock(Duration d) {
    final minutes = d.inMinutes;
    final seconds = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  String _stage(BuildContext context) {
    final l10n = context.l10n;
    final elapsed = _elapsed;
    if (elapsed >= SearchingStatusCard.busyAfter) return l10n.paxSearchStageBusy;
    if (elapsed >= SearchingStatusCard.widenAfter) return l10n.paxSearchStageWiden;
    return l10n.paxSearchStageNearby;
  }

  String? _nearbyLine(BuildContext context) {
    final count = widget.nearbyFreeDrivers;
    if (count == null) return null;
    final l10n = context.l10n;
    if (count <= 0) return l10n.paxNearbyNone;
    if (count >= SearchingStatusCard.manyThreshold) return l10n.paxNearbyFreeDriversMany;
    return l10n.paxNearbyFreeDrivers(count);
  }

  @override
  Widget build(BuildContext context) {
    final nearby = _nearbyLine(context);
    return Semantics(
      liveRegion: true,
      container: true,
      child: Row(
        children: [
          ExcludeSemantics(child: _Radar(pulse: _pulse)),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AnimatedSwitcher(
                  duration: const Duration(milliseconds: 220),
                  child: Text(
                    _stage(context),
                    key: ValueKey(_stage(context)),
                    style: const TextStyle(
                      fontSize: kFontBody,
                      fontWeight: FontWeight.w700,
                      color: kInk,
                    ),
                  ),
                ),
                if (widget.startedAt != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    context.l10n.paxSearchElapsed(_clock(_elapsed)),
                    style: const TextStyle(
                      fontSize: kFontLabel,
                      color: kInkMuted,
                      fontFeatures: [FontFeature.tabularFigures()],
                    ),
                  ),
                ],
                if (nearby != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    nearby,
                    key: const ValueKey('searching-nearby'),
                    style: TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w600,
                      color: (widget.nearbyFreeDrivers ?? 0) > 0 ? kPrimary : kWarningDeep,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Pulslanuvchi radar halqasi: markazda mashina, atrofida kengayib so'nuvchi
/// to'lqin. 1.8 s, past amplituda — "tizim ishlayapti" belgisi, diqqat
/// tortuvchi emas.
class _Radar extends StatelessWidget {
  const _Radar({required this.pulse});

  final Animation<double> pulse;

  static const double _size = 48;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: _size,
      height: _size,
      child: AnimatedBuilder(
        animation: pulse,
        builder: (context, child) {
          final t = pulse.value;
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: _size * (0.55 + 0.45 * t),
                height: _size * (0.55 + 0.45 * t),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: kPrimary.withValues(alpha: 0.22 * (1 - t)),
                ),
              ),
              child!,
            ],
          );
        },
        child: Container(
          width: _size * 0.55,
          height: _size * 0.55,
          decoration: const BoxDecoration(shape: BoxShape.circle, color: kPrimary),
          child: const Icon(Icons.local_taxi_rounded, size: 16, color: kOnPrimary),
        ),
      ),
    );
  }
}
