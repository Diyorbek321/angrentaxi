// ============================================================================
// SHIKOYAT VA HODISA (docs/INCIDENT-POLICY.md §3) — `incidents` modullari.
//
// Server kontrakti: backend/src/modules/incidents (incidents.service.ts).
//   POST /incidents                 — shikoyat qoldirish
//   POST /incidents/:id/photos      — foto (≤ 3)
//   GET  /incidents/mine            — men qoldirganlar ([ReporterIncident])
//   GET  /incidents/about-me        — menga nisbatan ([IncidentAboutMe])
//   POST /incidents/:id/appeal      — e'tiroz (bir marta, 7 kun)
//
// Sabablar ro'yxati — backend `incident-policy.ts#CATEGORIES_BY_SIDE` bilan
// AYNAN bir xil (server boshqasini 400 bilan rad etadi).
// ============================================================================

/// Buyurtma jadvali: `taxi` — taksi/posilka/yuk va kuryer safari (`orders`),
/// `food`/`market` — sotuvchi buyurtmasi.
abstract final class IncidentVertical {
  static const taxi = 'taxi';
  static const food = 'food';
  static const market = 'market';
}

/// Kim shikoyat qilmoqda.
enum IncidentReporterSide { customer, driver }

abstract final class IncidentCategory {
  static const rude = 'rude';
  static const dangerousDriving = 'dangerous_driving';
  static const detour = 'detour';
  static const overcharge = 'overcharge';
  static const smoking = 'smoking';
  static const dirtyCar = 'dirty_car';
  static const harassment = 'harassment';
  static const safety = 'safety';
  static const drunkPassenger = 'drunk_passenger';
  static const vehicleDamage = 'vehicle_damage';
  static const didNotPay = 'did_not_pay';
  static const noShow = 'no_show';
  static const damagedGoods = 'damaged_goods';
  static const wrongItems = 'wrong_items';
  static const coldFood = 'cold_food';
  static const lostCargo = 'lost_cargo';
  static const other = 'other';

  /// Tizim toifalari — foydalanuvchi tanlamaydi, faqat ro'yxatda ko'rinadi.
  static const ratingSignal = 'rating_signal';
  static const lowRating = 'low_rating';

  /// Safar davomida ham yuboriladigan toifalar (subyekt darhol to'xtatiladi).
  static const safetyOnly = [harassment, safety];

  static const _taxiCustomer = [
    rude,
    dangerousDriving,
    detour,
    overcharge,
    smoking,
    dirtyCar,
    harassment,
    safety,
    lostCargo,
    damagedGoods,
    other,
  ];
  static const _vendorCustomer = [
    wrongItems,
    coldFood,
    damagedGoods,
    rude,
    harassment,
    safety,
    other,
  ];
  static const _driver = [
    drunkPassenger,
    vehicleDamage,
    didNotPay,
    noShow,
    rude,
    harassment,
    safety,
    other,
  ];

  /// Ekrandagi tanlov ro'yxati.
  static List<String> forReport({
    required IncidentReporterSide side,
    required String vertical,
    bool safetyOnly = false,
  }) {
    if (safetyOnly) return IncidentCategory.safetyOnly;
    if (side == IncidentReporterSide.driver) return _driver;
    return vertical == IncidentVertical.taxi ? _taxiCustomer : _vendorCustomer;
  }
}

enum IncidentStatus { open, investigating, resolved, rejected }

IncidentStatus incidentStatusFromApi(dynamic value) => switch (value) {
      'investigating' => IncidentStatus.investigating,
      'resolved' => IncidentStatus.resolved,
      'rejected' => IncidentStatus.rejected,
      _ => IncidentStatus.open,
    };

DateTime? _date(dynamic value) =>
    value is String ? DateTime.tryParse(value)?.toLocal() : null;

double _num(dynamic value) => switch (value) {
      final num v => v.toDouble(),
      final String v => double.tryParse(v) ?? 0,
      _ => 0,
    };

String? _text(dynamic value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

/// Men qoldirgan shikoyat.
class ReporterIncident {
  const ReporterIncident({
    required this.id,
    required this.category,
    required this.description,
    required this.status,
    required this.createdAt,
    this.vertical,
    this.orderId,
    this.photoCount = 0,
    this.resolutionNote,
    this.refundAmount = 0,
    this.resolvedAt,
  });

  final String id;
  final String? vertical;
  final String? orderId;
  final String category;
  final String description;
  final IncidentStatus status;
  final int photoCount;
  final String? resolutionNote;

  /// Shu shikoyat bo'yicha hamyonimga qaytarilgan summa (so'm).
  final double refundAmount;
  final DateTime createdAt;
  final DateTime? resolvedAt;

  bool get isClosed =>
      status == IncidentStatus.resolved || status == IncidentStatus.rejected;

  factory ReporterIncident.fromJson(Map<String, dynamic> json) =>
      ReporterIncident(
        id: json['id'].toString(),
        vertical: _text(json['vertical']),
        orderId: _text(json['orderId']),
        category: json['category']?.toString() ?? IncidentCategory.other,
        description: json['description']?.toString() ?? '',
        status: incidentStatusFromApi(json['status']),
        photoCount: (json['photoCount'] as num?)?.toInt() ?? 0,
        resolutionNote: _text(json['resolutionNote']),
        refundAmount: _num(json['refundAmount']),
        createdAt: _date(json['createdAt']) ?? DateTime.now(),
        resolvedAt: _date(json['resolvedAt']),
      );
}

/// Menga nisbatan qo'llangan chora.
class IncidentSanction {
  const IncidentSanction({
    required this.type,
    this.amount,
    this.days,
    this.until,
    this.at,
  });

  /// `warning` | `suspension` | `block` | `penalty`.
  final String type;
  final double? amount;
  final int? days;
  final DateTime? until;
  final DateTime? at;

  factory IncidentSanction.fromJson(Map<String, dynamic> json) =>
      IncidentSanction(
        type: json['type']?.toString() ?? 'warning',
        amount: json['amount'] == null ? null : _num(json['amount']),
        days: (json['days'] as num?)?.toInt(),
        until: _date(json['until']),
        at: _date(json['at']),
      );
}

class IncidentAppealState {
  const IncidentAppealState({
    this.canAppeal = false,
    this.deadline,
    this.appealedAt,
    this.decision,
  });

  final bool canAppeal;
  final DateTime? deadline;
  final DateTime? appealedAt;

  /// `upheld` | `overturned` | `null` (hali hal qilinmagan).
  final String? decision;

  bool get pending => appealedAt != null && decision == null;

  factory IncidentAppealState.fromJson(dynamic json) {
    if (json is! Map) return const IncidentAppealState();
    return IncidentAppealState(
      canAppeal: json['canAppeal'] == true,
      deadline: _date(json['deadline']),
      appealedAt: _date(json['appealedAt']),
      decision: _text(json['decision']),
    );
  }
}

/// Menga nisbatan shikoyat — xabarchi kimligi va matni YO'Q (server bermaydi).
class SubjectIncident {
  const SubjectIncident({
    required this.id,
    required this.category,
    required this.status,
    this.vertical,
    this.orderId,
    this.resolutionNote,
    this.sanctions = const [],
    this.safetySuspended = false,
    this.resolvedAt,
    this.appeal = const IncidentAppealState(),
  });

  final String id;
  final String? vertical;
  final String? orderId;
  final String category;
  final IncidentStatus status;
  final String? resolutionNote;
  final List<IncidentSanction> sanctions;
  final bool safetySuspended;
  final DateTime? resolvedAt;
  final IncidentAppealState appeal;

  factory SubjectIncident.fromJson(Map<String, dynamic> json) {
    final raw = json['outcomes'];
    return SubjectIncident(
      id: json['id'].toString(),
      vertical: _text(json['vertical']),
      orderId: _text(json['orderId']),
      category: json['category']?.toString() ?? IncidentCategory.other,
      status: incidentStatusFromApi(json['status']),
      resolutionNote: _text(json['resolutionNote']),
      sanctions: raw is List
          ? raw
              .whereType<Map<dynamic, dynamic>>()
              .map((e) => IncidentSanction.fromJson(Map<String, dynamic>.from(e)))
              .toList(growable: false)
          : const [],
      safetySuspended: json['safetySuspended'] == true,
      resolvedAt: _date(json['resolvedAt']),
      appeal: IncidentAppealState.fromJson(json['appeal']),
    );
  }

  /// E'tiroz yuborilgandan keyingi mahalliy ko'rinish.
  SubjectIncident appealed(DateTime at) => SubjectIncident(
        id: id,
        vertical: vertical,
        orderId: orderId,
        category: category,
        status: IncidentStatus.investigating,
        resolutionNote: resolutionNote,
        sanctions: sanctions,
        safetySuspended: safetySuspended,
        resolvedAt: resolvedAt,
        appeal: IncidentAppealState(deadline: appeal.deadline, appealedAt: at),
      );
}

class AccountSuspension {
  const AccountSuspension({required this.until, this.reason});

  final DateTime until;
  final String? reason;

  static AccountSuspension? tryParse(dynamic json) {
    if (json is! Map) return null;
    final until = _date(json['until']);
    if (until == null) return null;
    return AccountSuspension(until: until, reason: _text(json['reason']));
  }
}

class IncidentAboutMe {
  const IncidentAboutMe({this.suspension, this.items = const []});

  final AccountSuspension? suspension;
  final List<SubjectIncident> items;

  factory IncidentAboutMe.fromJson(Map<String, dynamic> json) {
    final raw = json['items'];
    return IncidentAboutMe(
      suspension: AccountSuspension.tryParse(json['suspension']),
      items: raw is List
          ? raw
              .whereType<Map<dynamic, dynamic>>()
              .map((e) => SubjectIncident.fromJson(Map<String, dynamic>.from(e)))
              .toList(growable: false)
          : const [],
    );
  }
}
