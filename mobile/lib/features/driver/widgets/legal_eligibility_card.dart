import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/driver_legal.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter/material.dart';

/// Huquqiy talablar xulosasi: bajarilgan / bajarilmagan sabablar ro'yxati
/// va majburlash holati (bloklangan / muhlat / ogohlantirish).
///
/// Ma'no rangda yolg'iz qolmaydi: ikonka + sarlavha + matn (WCAG 1.4.1).
class LegalEligibilityCard extends StatelessWidget {
  const LegalEligibilityCard({
    super.key,
    required this.eligibility,
    this.onOpenDocuments,
  });

  final LegalEligibility eligibility;

  /// `document_*` sabablari bo'lsa "Hujjatlarni yuklash" tugmasi.
  final VoidCallback? onOpenDocuments;

  AppStatusTone get _tone {
    if (eligibility.eligible || eligibility.reasons.isEmpty) {
      return AppStatusTone.success;
    }
    return eligibility.blocking ? AppStatusTone.danger : AppStatusTone.warning;
  }

  String _statusLine(BuildContext context) {
    final l10n = context.l10n;
    if (eligibility.blocking) return l10n.lglStatusBlocking;
    final from = eligibility.enforcedFrom;
    if (eligibility.inGracePeriod && from != null) {
      return l10n.lglStatusGrace(Formatters.formatDate(from.toLocal()));
    }
    return l10n.lglStatusWarning;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    final tone = _tone;
    final ok = tone == AppStatusTone.success;

    return Container(
      key: const ValueKey('legal_eligibility_card'),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: tone.foreground.withValues(alpha: 0.25)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              ExcludeSemantics(
                child: Icon(
                  ok ? Icons.verified_rounded : tone.icon,
                  color: tone.foreground,
                ),
              ),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  ok ? l10n.lglEligibleTitle : l10n.lglNotEligibleTitle,
                  style: const TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace2),
          if (ok)
            Text(
              l10n.lglEligibleBody,
              style: const TextStyle(fontSize: kFontBody, color: kInk),
            )
          else ...[
            Text(
              _statusLine(context),
              key: const ValueKey('legal_status_line'),
              style: TextStyle(
                fontSize: kFontBody,
                color: tone.foreground,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: kSpace2),
            for (final reason in eligibility.reasons)
              LegalReasonRow(text: reason.message, code: reason.code),
            if (eligibility.hasDocumentReasons && onOpenDocuments != null) ...[
              const SizedBox(height: kSpace2),
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  key: const ValueKey('legal_open_documents'),
                  onPressed: onOpenDocuments,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(0, kMinTapTargetDriver),
                    foregroundColor: kInk,
                  ),
                  icon: const Icon(Icons.upload_file_rounded),
                  label: Text(l10n.lglOpenDocuments),
                ),
              ),
            ],
          ],
        ],
      ),
    );
  }
}

/// Bitta sabab qatori — nuqta + server matni.
class LegalReasonRow extends StatelessWidget {
  const LegalReasonRow({super.key, required this.text, this.code});

  final String text;
  final String? code;

  @override
  Widget build(BuildContext context) {
    return Padding(
      key: code == null ? null : ValueKey('legal_reason_$code'),
      padding: const EdgeInsets.symmetric(vertical: kSpace1),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Padding(
            padding: EdgeInsets.only(top: 7, right: kSpace2),
            child: ExcludeSemantics(
              child: Icon(Icons.circle, size: 6, color: kInk),
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: kFontBody,
                color: kInk,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
