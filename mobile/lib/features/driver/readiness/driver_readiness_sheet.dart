import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/readiness/driver_readiness.dart';
import 'package:angren_taxi/features/driver/readiness/readiness_checker.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';

/// Tavsiyalar (ustida ko'rsatish, batareya) sessiyada bir marta ko'rsatiladi: ular to'smaydi, har
/// "Onlayn" bosilganda chiqsa — bezovta qiladi va e'tiborsiz qoladi.
bool _recommendationsNudged = false;

/// Onlayn bo'lishdan oldin chaqiriladi. `true` — davom etish mumkin.
///
/// Hammasi joyida bo'lsa oyna umuman ko'rinmaydi (bir tegish ham qo'shilmaydi).
Future<bool> ensureDriverReady(
  BuildContext context, {
  ReadinessChecker checker = const PlatformReadinessChecker(),
}) async {
  final readiness = await checker.check();
  final recommendationsOnly = readiness.canGoOnline && !readiness.isComplete;
  if (readiness.isComplete || (recommendationsOnly && _recommendationsNudged)) {
    return true;
  }
  if (recommendationsOnly) _recommendationsNudged = true;
  if (!context.mounted) return false;

  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: kSurface,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(kRadiusLg)),
    ),
    builder: (_) => DriverReadinessSheet(checker: checker, initial: readiness),
  );
  return result ?? false;
}

class DriverReadinessSheet extends StatefulWidget {
  const DriverReadinessSheet({super.key, required this.checker, required this.initial});

  final ReadinessChecker checker;
  final DriverReadiness initial;

  @override
  State<DriverReadinessSheet> createState() => _DriverReadinessSheetState();
}

class _DriverReadinessSheetState extends State<DriverReadinessSheet>
    with WidgetsBindingObserver {
  late DriverReadiness _readiness = widget.initial;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Sozlamalardan qaytganda holat qayta o'qiladi — haydovchi u yerda nima
  /// o'zgartirganini ilova o'zi bilmaydi.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    final next = await widget.checker.check();
    if (mounted) setState(() => _readiness = next);
  }

  Future<void> _fix(ReadinessItem item) async {
    await widget.checker.fix(item);
    await _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              l10n.drvReadyTitle,
              style: const TextStyle(fontSize: kFontH2, fontWeight: FontWeight.w800, color: kInk),
            ),
            const SizedBox(height: kSpace1),
            Text(
              l10n.drvReadySubtitle,
              style: const TextStyle(fontSize: kFontLabel, color: kInkMuted, height: 1.35),
            ),
            const SizedBox(height: kSpace3),
            Flexible(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    for (final item in ReadinessItem.values)
                      _ReadinessRow(
                        item: item,
                        ok: _readiness.isOk(item),
                        blocking: DriverReadiness.blocking.contains(item),
                        onFix: _readiness.canFix(item) ? () => _fix(item) : null,
                        extraHint: item == ReadinessItem.overlay && _readiness.xiaomiFamily
                            ? context.l10n.drvReadyOverlayXiaomi
                            : null,
                      ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: kSpace4),
            AppButton(
              label: l10n.drvReadyGoOnline,
              height: kControlHeightDriver,
              onPressed: _readiness.canGoOnline ? () => Navigator.of(context).pop(true) : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _ReadinessRow extends StatelessWidget {
  const _ReadinessRow({
    required this.item,
    required this.ok,
    required this.blocking,
    required this.onFix,
    this.extraHint,
  });

  /// Qo'shimcha ko'rsatma (masalan, MIUI'ning alohida ruxsati) — band
  /// bajarilgan bo'lsa ham ko'rinadi, chunki uni dastur tekshira olmaydi.
  final String? extraHint;

  final ReadinessItem item;
  final bool ok;
  final bool blocking;
  final VoidCallback? onFix;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final (title, why, action) = switch (item) {
      ReadinessItem.gps => (l10n.drvReadyGps, l10n.drvReadyGpsWhy, l10n.drvReadyEnable),
      ReadinessItem.location => (l10n.drvReadyLocation, l10n.drvReadyLocationWhy, l10n.drvReadyGrant),
      ReadinessItem.preciseLocation => (l10n.drvReadyPrecise, l10n.drvReadyPreciseWhy, l10n.drvReadyGrant),
      ReadinessItem.notifications =>
        (l10n.drvReadyNotifications, l10n.drvReadyNotificationsWhy, l10n.drvReadyGrant),
      ReadinessItem.overlay => (l10n.drvReadyOverlay, l10n.drvReadyOverlayWhy, l10n.drvReadyOpenSettings),
      ReadinessItem.battery => (l10n.drvReadyBattery, l10n.drvReadyBatteryWhy, l10n.drvReadyOpenSettings),
    };

    // Rang yolg'iz ma'no tashimaydi: ikonka SHAKLI ham farq qiladi
    // (belgi / undov) va holat ekran o'quvchiga so'z bilan aytiladi.
    final Color tone = ok ? kPrimary : (blocking ? kError : kWarningDeep);
    final IconData icon = ok
        ? Icons.check_circle_rounded
        : (blocking ? Icons.error_rounded : Icons.info_rounded);

    return Semantics(
      container: true,
      label: '$title: ${ok ? l10n.drvReadyDone : l10n.drvReadyMissing}'
          '${extraHint != null ? '. $extraHint' : ''}',
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: kSpace2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ExcludeSemantics(child: Icon(icon, color: tone, size: 24)),
            const SizedBox(width: kSpace3),
            Expanded(
              child: ExcludeSemantics(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            style: const TextStyle(
                              fontSize: kFontBody,
                              fontWeight: FontWeight.w700,
                              color: kInk,
                            ),
                          ),
                        ),
                        if (!blocking) ...[
                          const SizedBox(width: kSpace2),
                          Text(
                            l10n.drvReadyRecommended,
                            style: const TextStyle(fontSize: kFontCaption, color: kInkMuted),
                          ),
                        ],
                      ],
                    ),
                    if (!ok) ...[
                      const SizedBox(height: 2),
                      Text(
                        why,
                        style: const TextStyle(fontSize: kFontCaption, color: kInkMuted, height: 1.35),
                      ),
                    ],
                    if (extraHint != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        extraHint!,
                        style: const TextStyle(fontSize: kFontCaption, color: kInk, height: 1.35),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (!ok && onFix != null) ...[
              const SizedBox(width: kSpace2),
              TextButton(
                onPressed: onFix,
                style: TextButton.styleFrom(
                  minimumSize: const Size(kMinTapTargetDriver, kMinTapTargetDriver),
                ),
                child: Text(action),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
