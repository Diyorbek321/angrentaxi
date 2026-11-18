import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/incidents/screens/my_incidents_screen.dart';
import 'package:angren_taxi/features/incidents/screens/report_incident_screen.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/incident.dart';
import 'package:flutter/material.dart';

/// Shikoyat qoldirish mumkin bo'lgan oyna (server: 7 kun, buyurtma tugaganidan).
/// Ilova faqat tugmani ko'rsatish-ko'rsatmaslikni hal qiladi — aniq tekshiruv serverda.
bool incidentReportWindowOpen(DateTime? endedAt, {DateTime? now, int days = 7}) {
  if (endedAt == null) return false;
  return (now ?? DateTime.now()).difference(endedAt) <= Duration(days: days);
}

/// Baholash ekranidagi havola: past baho (1–2) — "Shikoyat qoldirish"; haydovchi
/// uchun [always] bilan doim ko'rinadi.
class IncidentComplaintLink extends StatelessWidget {
  const IncidentComplaintLink({
    super.key,
    required this.args,
    required this.score,
    this.always = false,
  });

  final IncidentReportArgs args;
  final int score;
  final bool always;

  static bool visibleFor(int score, {bool always = false}) => always || (score >= 1 && score <= 2);

  @override
  Widget build(BuildContext context) {
    if (!visibleFor(score, always: always)) return const SizedBox.shrink();
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        key: const ValueKey('incident-complaint-link'),
        onPressed: () => openIncidentReport(context, args),
        icon: const Icon(Icons.flag_outlined, size: 18, color: kErrorDeep),
        label: Text(
          context.l10n.incComplainAction,
          style: const TextStyle(color: kErrorDeep, fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

/// Onlayn chiqish `ACCOUNT_SUSPENDED` bilan rad etildi — muddat va sabab,
/// "Batafsil" → "Murojaatlarim / Menga nisbatan" (e'tiroz shu yerda).
Future<void> showSuspensionDialog(BuildContext context, AccountSuspension suspension) {
  final l10n = context.l10n;
  return showDialog<void>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: Text(l10n.incSuspendedDialogTitle),
      content: SuspensionBanner(suspension: suspension),
      actions: [
        TextButton(onPressed: () => Navigator.of(dialog).pop(), child: Text(l10n.incClose)),
        FilledButton(
          onPressed: () {
            Navigator.of(dialog).pop();
            Navigator.of(context).push(
              MaterialPageRoute<void>(builder: (_) => const MyIncidentsScreen(initialTab: 1)),
            );
          },
          child: Text(l10n.incOpenDetails),
        ),
      ],
    ),
  );
}
