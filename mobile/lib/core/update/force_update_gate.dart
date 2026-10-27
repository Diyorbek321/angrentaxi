import 'dart:async';

import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/update/app_update.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Ilova ishga tushganda va fondan qaytganda versiyani tekshiradi.
///
/// * majburiy — butun ilova o'rniga "yangilang" ekrani (orqaga yo'l yo'q);
/// * ixtiyoriy — pastda yopiladigan taklif, sessiyada bir marta.
///
/// [check] `null` (demo, test) — hech narsa qilinmaydi.
class ForceUpdateGate extends StatefulWidget {
  const ForceUpdateGate({
    super.key,
    required this.check,
    required this.child,
    this.recheckAfter = const Duration(minutes: 30),
  });

  final Future<UpdateCheckResult?> Function()? check;
  final Widget child;
  final Duration recheckAfter;

  @override
  State<ForceUpdateGate> createState() => _ForceUpdateGateState();
}

class _ForceUpdateGateState extends State<ForceUpdateGate>
    with WidgetsBindingObserver {
  UpdateCheckResult? _result;
  DateTime? _lastCheck;
  bool _optionalDismissed = false;
  bool _checking = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_run());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) return;
    final last = _lastCheck;
    if (last == null ||
        DateTime.now().difference(last) >= widget.recheckAfter) {
      unawaited(_run());
    }
  }

  Future<void> _run() async {
    final check = widget.check;
    if (check == null || _checking) return;
    _checking = true;
    try {
      final result = await check();
      _lastCheck = DateTime.now();
      if (result != null && mounted) setState(() => _result = result);
    } finally {
      _checking = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result?.requirement == UpdateRequirement.required) {
      return _ForceUpdateScreen(updateUrl: result!.policy.updateUrl);
    }
    final showOptional = result?.requirement == UpdateRequirement.optional &&
        !_optionalDismissed;
    return Stack(
      children: [
        widget.child,
        if (showOptional)
          Positioned(
            left: kSpace4,
            right: kSpace4,
            bottom: MediaQuery.paddingOf(context).bottom + kSpace4,
            child: _OptionalUpdateCard(
              updateUrl: result!.policy.updateUrl,
              onDismiss: () => setState(() => _optionalDismissed = true),
            ),
          ),
      ],
    );
  }
}

Future<void> _openUpdate(String? url) async {
  final uri = url == null ? null : Uri.tryParse(url);
  if (uri == null) return;
  try {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    // Brauzer yo'q — tugma hech narsa qilmaydi, ekran o'z joyida qoladi.
  }
}

class _ForceUpdateScreen extends StatelessWidget {
  const _ForceUpdateScreen({required this.updateUrl});

  final String? updateUrl;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(kSpace6),
          child: Column(
            children: [
              const Spacer(),
              const Icon(
                Icons.system_update_rounded,
                size: 72,
                color: kPrimary,
              ),
              const SizedBox(height: kSpace6),
              Text(
                l10n.shUpdateRequiredTitle,
                textAlign: TextAlign.center,
                style: theme.textTheme.headlineSmall,
              ),
              const SizedBox(height: kSpace3),
              Text(
                l10n.shUpdateRequiredBody,
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyLarge,
              ),
              const Spacer(),
              if (updateUrl != null)
                AppButton(
                  label: l10n.shUpdateAction,
                  onPressed: () => _openUpdate(updateUrl),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OptionalUpdateCard extends StatelessWidget {
  const _OptionalUpdateCard({required this.updateUrl, required this.onDismiss});

  final String? updateUrl;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Material(
      elevation: 6,
      color: Theme.of(context).colorScheme.surface,
      borderRadius: BorderRadius.circular(kRadiusMd),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(kSpace4, kSpace2, kSpace1, kSpace2),
        child: Row(
          children: [
            const Icon(Icons.system_update_rounded, color: kPrimary),
            const SizedBox(width: kSpace3),
            Expanded(child: Text(l10n.shUpdateAvailable)),
            if (updateUrl != null)
              TextButton(
                onPressed: () => _openUpdate(updateUrl),
                child: Text(l10n.shUpdateAction),
              ),
            // `tooltip` YO'Q: karta Navigator ustida, Overlay'dan tashqarida.
            Semantics(
              button: true,
              label: l10n.saClose,
              excludeSemantics: true,
              child: IconButton(
                icon: const Icon(Icons.close_rounded),
                onPressed: onDismiss,
                constraints: const BoxConstraints(
                  minWidth: kMinTapTarget,
                  minHeight: kMinTapTarget,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
