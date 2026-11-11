import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/incident.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';

/// Sabab kodi → joriy tildagi matn. Noma'lum kod (yangi server) — "Boshqa".
String incidentCategoryLabel(AppLocalizations l10n, String category) => switch (category) {
      IncidentCategory.rude => l10n.incCatRude,
      IncidentCategory.dangerousDriving => l10n.incCatDangerousDriving,
      IncidentCategory.detour => l10n.incCatDetour,
      IncidentCategory.overcharge => l10n.incCatOvercharge,
      IncidentCategory.smoking => l10n.incCatSmoking,
      IncidentCategory.dirtyCar => l10n.incCatDirtyCar,
      IncidentCategory.harassment => l10n.incCatHarassment,
      IncidentCategory.safety => l10n.incCatSafety,
      IncidentCategory.drunkPassenger => l10n.incCatDrunkPassenger,
      IncidentCategory.vehicleDamage => l10n.incCatVehicleDamage,
      IncidentCategory.didNotPay => l10n.incCatDidNotPay,
      IncidentCategory.noShow => l10n.incCatNoShow,
      IncidentCategory.damagedGoods => l10n.incCatDamagedGoods,
      IncidentCategory.wrongItems => l10n.incCatWrongItems,
      IncidentCategory.coldFood => l10n.incCatColdFood,
      IncidentCategory.lostCargo => l10n.incCatLostCargo,
      IncidentCategory.ratingSignal => l10n.incCatRatingSignal,
      IncidentCategory.lowRating => l10n.incCatLowRating,
      _ => l10n.incCatOther,
    };

String incidentStatusLabel(AppLocalizations l10n, IncidentStatus status) => switch (status) {
      IncidentStatus.open => l10n.incStatusOpen,
      IncidentStatus.investigating => l10n.incStatusInvestigating,
      IncidentStatus.resolved => l10n.incStatusResolved,
      IncidentStatus.rejected => l10n.incStatusRejected,
    };

String incidentSanctionLabel(AppLocalizations l10n, IncidentSanction s) => switch (s.type) {
      'suspension' => l10n.incSanctionSuspension(
          s.days ?? 0,
          s.until == null ? '—' : Formatters.formatDateTime(s.until!),
        ),
      'block' => l10n.incSanctionBlock,
      'penalty' => l10n.incSanctionPenalty(Formatters.formatSom(s.amount ?? 0)),
      _ => l10n.incSanctionWarning,
    };

/// `ACCOUNT_SUSPENDED` xatosidan to'xtatish (muddat + sabab). Boshqa xato — `null`.
AccountSuspension? suspensionFromError(ApiError? error) {
  if (error?.code != ApiErrorCode.accountSuspended) return null;
  final until = DateTime.tryParse(error!.detailText('until') ?? '')?.toLocal();
  if (until == null) return null;
  return AccountSuspension(until: until, reason: error.detailText('reason'));
}
