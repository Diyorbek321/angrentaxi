import 'package:equatable/equatable.dart';

// ============================================================================
// HAYDOVCHI SMENASI (kunlik obuna) — docs/LEGAL-COMPLIANCE.md §8, §10.
//
//   GET  /drivers/me/shift-pass → ShiftPassInfo
//   POST /drivers/me/shift-pass → ShiftPass (400 o'chiq/balans, 409 faol bor)
// ============================================================================

enum ShiftPassStatus { active, expired, cancelled, unknown }

ShiftPassStatus _statusFromWire(String? value) => switch (value) {
      'active' => ShiftPassStatus.active,
      'expired' => ShiftPassStatus.expired,
      'cancelled' => ShiftPassStatus.cancelled,
      _ => ShiftPassStatus.unknown,
    };

List<String> _stringList(dynamic value) => value is List
    ? value.whereType<String>().toList(growable: false)
    : const [];

class ShiftPass extends Equatable {
  const ShiftPass({
    required this.id,
    required this.startsAt,
    required this.endsAt,
    required this.price,
    required this.status,
    this.serviceTypes = const [],
  });

  final String id;
  final DateTime startsAt;
  final DateTime endsAt;
  final double price;
  final ShiftPassStatus status;
  final List<String> serviceTypes;

  /// Hozir amal qiladimi (holat + vaqt oralig'i).
  bool isActiveAt(DateTime now) =>
      status == ShiftPassStatus.active &&
      !now.isBefore(startsAt) &&
      now.isBefore(endsAt);

  Duration remainingAt(DateTime now) {
    final left = endsAt.difference(now);
    return left.isNegative ? Duration.zero : left;
  }

  static ShiftPass? tryParse(dynamic json) {
    if (json is! Map<String, dynamic>) return null;
    final starts = DateTime.tryParse(json['startsAt']?.toString() ?? '');
    final ends = DateTime.tryParse(json['endsAt']?.toString() ?? '');
    if (starts == null || ends == null) return null;
    return ShiftPass(
      id: json['id']?.toString() ?? '',
      startsAt: starts.toLocal(),
      endsAt: ends.toLocal(),
      price: (json['price'] as num?)?.toDouble() ?? 0,
      status: _statusFromWire(json['status'] as String?),
      serviceTypes: _stringList(json['serviceTypes']),
    );
  }

  @override
  List<Object?> get props => [id, startsAt, endsAt, price, status, serviceTypes];
}

enum ShiftPassCheaperOption { shiftPass, commission, equal }

class ShiftPassComparison extends Equatable {
  const ShiftPassComparison({
    this.periodDays = 7,
    this.commissionPaid = 0,
    this.workingDays = 0,
    this.passCost = 0,
    this.cheaperOption = ShiftPassCheaperOption.equal,
    this.savings = 0,
  });

  final int periodDays;

  /// Oxirgi [periodDays] kunda smena qamraydigan xizmatlarda to'langan
  /// komissiya.
  final double commissionPaid;

  /// Kamida bitta yakunlangan safar bo'lgan kunlar.
  final int workingDays;

  /// Har ish kuniga bitta smena bo'lganda jami narx.
  final double passCost;
  final ShiftPassCheaperOption cheaperOption;
  final double savings;

  static const empty = ShiftPassComparison();

  factory ShiftPassComparison.fromJson(Map<String, dynamic> json) {
    return ShiftPassComparison(
      periodDays: (json['periodDays'] as num?)?.toInt() ?? 7,
      commissionPaid: (json['commissionPaid'] as num?)?.toDouble() ?? 0,
      workingDays: (json['workingDays'] as num?)?.toInt() ?? 0,
      passCost: (json['passCost'] as num?)?.toDouble() ?? 0,
      cheaperOption: switch (json['cheaperOption']) {
        'shift_pass' => ShiftPassCheaperOption.shiftPass,
        'commission' => ShiftPassCheaperOption.commission,
        _ => ShiftPassCheaperOption.equal,
      },
      savings: (json['savings'] as num?)?.toDouble() ?? 0,
    );
  }

  @override
  List<Object?> get props =>
      [periodDays, commissionPaid, workingDays, passCost, cheaperOption, savings];
}

class ShiftPassInfo extends Equatable {
  const ShiftPassInfo({
    this.enabled = false,
    this.price = 0,
    this.durationHours = 24,
    this.serviceTypes = const [],
    this.current,
    this.comparison = ShiftPassComparison.empty,
  });

  final bool enabled;
  final double price;
  final int durationHours;
  final List<String> serviceTypes;
  final ShiftPass? current;
  final ShiftPassComparison comparison;

  static const disabled = ShiftPassInfo();

  factory ShiftPassInfo.fromJson(Map<String, dynamic> json) {
    final comparison = json['comparison'];
    return ShiftPassInfo(
      enabled: (json['enabled'] as bool?) ?? false,
      price: (json['price'] as num?)?.toDouble() ?? 0,
      durationHours: (json['durationHours'] as num?)?.toInt() ?? 24,
      serviceTypes: _stringList(json['serviceTypes']),
      current: ShiftPass.tryParse(json['current']),
      comparison: comparison is Map<String, dynamic>
          ? ShiftPassComparison.fromJson(comparison)
          : ShiftPassComparison.empty,
    );
  }

  ShiftPassInfo withCurrent(ShiftPass? pass) => ShiftPassInfo(
        enabled: enabled,
        price: price,
        durationHours: durationHours,
        serviceTypes: serviceTypes,
        current: pass,
        comparison: comparison,
      );

  @override
  List<Object?> get props =>
      [enabled, price, durationHours, serviceTypes, current, comparison];
}
