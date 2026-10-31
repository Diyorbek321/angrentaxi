import 'dart:async';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/trip/meter/meter_reading.dart';
import 'package:angren_taxi/features/trip/meter/meter_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';

/// Ko'rsatkich qanchalik tez-tez yangilanadi. GPS izi serverga ~10 m da
/// bir keladi; 10 s shahar tezligida ~100 m — summa sezilarli sakramaydi.
const Duration kMeterRefresh = Duration(seconds: 10);

/// Taksometr kartasi — haydovchi ham, yo'lovchi ham shuni ko'radi.
///
/// Hisob serverda; bu vidjet faqat so'raydi va chizadi. Tarmoq uzilsa
/// oxirgi muvaffaqiyatli raqam qoladi (bo'sh karta "taksometr to'xtadi"
/// degan noto'g'ri ma'no berardi).
class LiveMeterCard extends StatefulWidget {
  const LiveMeterCard({
    super.key,
    required this.orderId,
    required this.service,
    this.minFare,
    this.refresh = kMeterRefresh,
  });

  final String orderId;
  final MeterService service;

  /// Birinchi javob kelguncha ko'rsatiladigan "kamida" summa.
  final double? minFare;
  final Duration refresh;

  @override
  State<LiveMeterCard> createState() => _LiveMeterCardState();
}

class _LiveMeterCardState extends State<LiveMeterCard> {
  MeterReading? _reading;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
    _timer = Timer.periodic(widget.refresh, (_) => _load());
  }

  Future<void> _load() async {
    try {
      final reading = await widget.service.reading(widget.orderId);
      if (mounted) setState(() => _reading = reading);
    } catch (e) {
      debugPrint('[Meter] ${widget.orderId}: $e');
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reading = _reading;
    final l10n = context.l10n;
    final fareText = reading != null
        ? Formatters.formatPrice(reading.fare)
        : (widget.minFare != null
            ? l10n.shMeterAtLeast(Formatters.formatPrice(widget.minFare!))
            : '—');
    final detail = reading != null
        ? l10n.shMeterDistanceTime(
            Formatters.formatDistance(reading.distanceKm * 1000),
            reading.durationMin,
          )
        : null;

    return Semantics(
      container: true,
      liveRegion: true,
      label: [l10n.shMeterTitle, fareText, if (detail != null) detail].join(', '),
      excludeSemantics: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: kInk,
          borderRadius: BorderRadius.circular(kRadiusLg),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.speed_rounded, color: kOnPrimary, size: 18),
                const SizedBox(width: kSpace2),
                Text(
                  l10n.shMeterTitle,
                  style: TextStyle(
                    color: kOnPrimary.withValues(alpha: 0.8),
                    fontSize: kFontCaption,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const Spacer(),
                if (detail != null)
                  Text(
                    detail,
                    style: TextStyle(
                      color: kOnPrimary.withValues(alpha: 0.8),
                      fontSize: kFontCaption,
                      fontWeight: FontWeight.w600,
                      fontFeatures: const [FontFeature.tabularFigures()],
                    ),
                  ),
              ],
            ),
            const SizedBox(height: kSpace2),
            Text(
              fareText,
              style: const TextStyle(
                color: kOnPrimary,
                fontSize: kFontH1,
                fontWeight: FontWeight.w800,
                fontFeatures: [FontFeature.tabularFigures()],
              ),
            ),
            const SizedBox(height: kSpace1),
            Text(
              l10n.shMeterFinalNote,
              style: TextStyle(
                color: kOnPrimary.withValues(alpha: 0.7),
                fontSize: kFontCaption,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
