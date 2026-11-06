import 'dart:async';

import 'package:angren_taxi/core/config/app_motion.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// Real vaqt aloqasi uzilganda ekran tepasida chiqadigan kichik belgi.
///
/// NEGA: socket uzilsa haydovchi markeri va safar holati jimgina qotib
/// qolardi — foydalanuvchi ilova "osilib qoldi" deb o'ylardi. Belgi
/// [grace] dan uzoq uzilishdagina chiqadi: tunnel yoki lift ichidagi bir
/// soniyalik uzilish ekranni "miltillatmasin".
class ConnectionBanner extends StatefulWidget {
  const ConnectionBanner({
    super.key,
    required this.offline,
    required this.child,
    this.grace = const Duration(seconds: 3),
  });

  final ValueListenable<bool> offline;
  final Widget child;
  final Duration grace;

  @override
  State<ConnectionBanner> createState() => _ConnectionBannerState();
}

class _ConnectionBannerState extends State<ConnectionBanner> {
  Timer? _graceTimer;
  bool _visible = false;

  @override
  void initState() {
    super.initState();
    widget.offline.addListener(_onChanged);
    _onChanged();
  }

  @override
  void didUpdateWidget(ConnectionBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.offline != widget.offline) {
      oldWidget.offline.removeListener(_onChanged);
      widget.offline.addListener(_onChanged);
      _onChanged();
    }
  }

  @override
  void dispose() {
    widget.offline.removeListener(_onChanged);
    _graceTimer?.cancel();
    super.dispose();
  }

  void _onChanged() {
    if (widget.offline.value) {
      _graceTimer ??= Timer(widget.grace, () {
        if (mounted) setState(() => _visible = true);
      });
    } else {
      _graceTimer?.cancel();
      _graceTimer = null;
      if (_visible) setState(() => _visible = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.paddingOf(context).top + kSpace2;
    return Stack(
      children: [
        widget.child,
        Positioned(
          top: top,
          left: 0,
          right: 0,
          child: IgnorePointer(
            child: Center(
              child: AnimatedSwitcher(
                duration: AppMotion.duration(context, AppMotion.base),
                switchInCurve: Curves.easeOutCubic,
                switchOutCurve: Curves.easeInCubic,
                child: _visible
                    ? const _OfflinePill(key: ValueKey('offline'))
                    : const SizedBox.shrink(),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _OfflinePill extends StatelessWidget {
  const _OfflinePill({super.key});

  @override
  Widget build(BuildContext context) {
    final label = context.l10n.shReconnecting;
    return Semantics(
      liveRegion: true,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: kInk,
        elevation: 4,
        shape: const StadiumBorder(),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: kSpace3,
            vertical: kSpace2,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(
                width: 14,
                height: 14,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: kWarningDark,
                ),
              ),
              const SizedBox(width: kSpace2),
              Flexible(
                child: Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context)
                      .textTheme
                      .labelMedium
                      ?.copyWith(color: kOnPrimary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
