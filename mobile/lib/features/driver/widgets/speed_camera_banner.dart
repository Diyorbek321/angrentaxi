import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/location/speed_cameras.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';

/// Oldindagi tezlik kamerasi: chegara belgisi, masofa.
///
/// Tezlik chegaradan oshsa butun karta QIZIL — haydovchi ko'z qirrasi
/// bilan ham sezadi. Ovoz bir marta aytadi, banner esa kamera o'tguncha
/// turadi.
class SpeedCameraBanner extends StatelessWidget {
  const SpeedCameraBanner({super.key, required this.alert});

  final SpeedCameraAlert alert;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final limit = alert.camera.maxSpeedKmh;
    final danger = alert.overSpeed;
    // Qizil fonda oq yozuv 3.9:1 — yirik qalin matn uchun (≥3:1) yetarli.
    final ink = danger ? Colors.white : kInk;
    final distance = Formatters.formatDistance(alert.distanceMeters);

    return Semantics(
      liveRegion: true,
      label: l10n.drvCameraSem(distance),
      excludeSemantics: true,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: kSpace3, vertical: kSpace2),
        decoration: BoxDecoration(
          color: danger ? kError : kSurface,
          borderRadius: BorderRadius.circular(kRadiusMd),
          boxShadow: kShadowCard,
        ),
        child: Row(
          children: [
            _LimitSign(limit: limit),
            const SizedBox(width: kSpace3),
            Icon(Icons.photo_camera_outlined, color: ink, size: 22),
            const SizedBox(width: kSpace2),
            Expanded(
              child: Text(
                limit != null
                    ? '${l10n.drvCameraAhead} · ${l10n.drvCameraLimit(limit)}'
                    : l10n.drvCameraAhead,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: kFontBody,
                  fontWeight: FontWeight.w700,
                  color: ink,
                ),
              ),
            ),
            Text(
              distance,
              style: TextStyle(
                fontSize: kFontH3,
                fontWeight: FontWeight.w800,
                color: ink,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Yo'l belgisidek: oq doira, qizil hoshiya, chegara raqami.
class _LimitSign extends StatelessWidget {
  const _LimitSign({required this.limit});

  final int? limit;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 40,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: kError, width: 4),
      ),
      child: limit == null
          ? const Icon(Icons.speed, color: kInk, size: 18)
          : Text(
              '$limit',
              style: const TextStyle(
                fontSize: kFontBody,
                fontWeight: FontWeight.w900,
                color: kInk,
              ),
            ),
    );
  }
}
