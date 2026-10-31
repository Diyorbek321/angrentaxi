import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/models/route_step.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';

/// Navigatsiya ekranining tepasidagi manevr paneli.
///
/// NEGA ekranda ham ko'rsatiladi, ovoz yetarli emasmi: TTS ovozi qurilmada
/// bo'lmasligi mumkin (uz-UZ hamma joyda yo'q), radio baland bo'lishi yoki
/// haydovchi gapni eshitmay qolishi mumkin. Banner — ovozning zaxirasi
/// emas, tengi: ikkalasi bir manbadan (`ManeuverPhrases`) oziqlanadi.
class ManeuverBanner extends StatelessWidget {
  const ManeuverBanner({
    super.key,
    required this.step,
    required this.instruction,
    required this.distanceMeters,
  });

  /// Oldinda turgan manevr.
  final RouteStep step;

  /// O'zbekcha ko'rsatma matni (`ManeuverPhrases` dan).
  final String instruction;

  /// Manevrgacha qolgan masofa (metr).
  final double distanceMeters;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: kSpace4,
        vertical: kSpace3,
      ),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        boxShadow: kShadowCard,
      ),
      child: Row(
        children: [
          // Manevr ikonasi — mint fonda ink rangda (yorug' mint ustida oq
          // ikona 2.12:1 bo'lib, quyoshda umuman ko'rinmaydi).
          Container(
            width: kMinTapTarget,
            height: kMinTapTarget,
            decoration: const BoxDecoration(
              color: kMintTint,
              shape: BoxShape.circle,
            ),
            child: ExcludeSemantics(
              child: Icon(iconFor(step), color: kPrimary, size: 26),
            ),
          ),
          const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Masofa birinchi va yirik: haydovchi bir ko'z tashlashda
                // "qancha qoldi" ni o'qiydi, matnni esa keyin.
                Text(
                  Formatters.formatDistance(distanceMeters),
                  style: const TextStyle(
                    fontSize: kFontH3,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
                Text(
                  instruction,
                  style: const TextStyle(
                    fontSize: kFontBody,
                    fontWeight: FontWeight.w600,
                    color: kInkMuted,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Manevrga mos ikona.
  ///
  /// `switch` TO'LIQ: `ManeuverType` ga yangi qiymat qo'shilsa analizator
  /// shu yerni ham eslatadi va ikona tanlanmay qolmaydi.
  static IconData iconFor(RouteStep step) {
    return switch (step.type) {
      ManeuverType.depart => Icons.navigation,
      ManeuverType.arrive => Icons.place,
      ManeuverType.merge => Icons.merge,
      ManeuverType.onRamp || ManeuverType.offRamp => _rampIcon(step.modifier),
      ManeuverType.fork => _forkIcon(step.modifier),
      ManeuverType.roundabout ||
      ManeuverType.rotary ||
      ManeuverType.roundaboutTurn ||
      ManeuverType.exitRoundabout ||
      ManeuverType.exitRotary =>
        _roundaboutIcon(step.modifier),
      ManeuverType.straightOn ||
      ManeuverType.newName ||
      ManeuverType.notification =>
        Icons.straight,
      ManeuverType.turn ||
      ManeuverType.endOfRoad ||
      ManeuverType.unknown =>
        _turnIcon(step.modifier),
    };
  }

  static IconData _turnIcon(ManeuverModifier modifier) {
    return switch (modifier) {
      ManeuverModifier.uturn => Icons.u_turn_left,
      ManeuverModifier.sharpRight => Icons.turn_sharp_right,
      ManeuverModifier.right => Icons.turn_right,
      ManeuverModifier.slightRight => Icons.turn_slight_right,
      ManeuverModifier.sharpLeft => Icons.turn_sharp_left,
      ManeuverModifier.left => Icons.turn_left,
      ManeuverModifier.slightLeft => Icons.turn_slight_left,
      // Yo'nalish noma'lum — matn ham "yo'lda davom eting" deydi.
      ManeuverModifier.straight || ManeuverModifier.none => Icons.straight,
    };
  }

  static IconData _forkIcon(ManeuverModifier modifier) {
    return _isLeft(modifier) ? Icons.fork_left : Icons.fork_right;
  }

  static IconData _rampIcon(ManeuverModifier modifier) {
    return _isLeft(modifier) ? Icons.ramp_left : Icons.ramp_right;
  }

  static IconData _roundaboutIcon(ManeuverModifier modifier) {
    return _isLeft(modifier) ? Icons.roundabout_left : Icons.roundabout_right;
  }

  static bool _isLeft(ManeuverModifier modifier) {
    return modifier == ManeuverModifier.left ||
        modifier == ManeuverModifier.sharpLeft ||
        modifier == ManeuverModifier.slightLeft;
  }
}
