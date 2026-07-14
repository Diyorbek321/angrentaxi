import 'package:equatable/equatable.dart';

// Mirrors backend `BonusRuleType` enum
// (backend/src/database/entities/driver-bonus-rule.entity.ts).
enum BonusRuleType {
  // Award every `tripThreshold` completed trips (lifetime), repeating per
  // tier. `currentCount` for this type is `totalTrips % tripThreshold`.
  tripCount,
  // Award once per ISO week if trips-this-week >= tripThreshold.
  // `currentCount` for this type is trips completed since the start of the
  // current ISO week.
  weeklyGoal,
}

BonusRuleType _bonusRuleTypeFromApi(String value) {
  switch (value) {
    case 'weekly_goal':
      return BonusRuleType.weeklyGoal;
    case 'trip_count':
    default:
      return BonusRuleType.tripCount;
  }
}

// One active bonus rule's progress for the current driver, as returned by
// GET /driver-bonus-rules/me/progress (backend/src/modules/driver-bonuses/
// driver-bonuses.service.ts#getProgressForDriver / `DriverBonusProgress`).
class DriverBonusProgress extends Equatable {
  const DriverBonusProgress({
    required this.ruleId,
    required this.name,
    required this.ruleType,
    required this.tripThreshold,
    required this.bonusAmount,
    required this.currentCount,
  });

  final String ruleId;
  final String name;
  final BonusRuleType ruleType;
  final int tripThreshold;
  final double bonusAmount;
  final int currentCount;

  // Fraction toward the reward, clamped to [0, 1] — tripThreshold is always
  // > 0 on the backend (validated at rule creation), but this guards against
  // a malformed/zero value rather than dividing by zero.
  double get progressFraction {
    if (tripThreshold <= 0) return 0;
    return (currentCount / tripThreshold).clamp(0, 1).toDouble();
  }

  factory DriverBonusProgress.fromJson(Map<String, dynamic> json) {
    return DriverBonusProgress(
      ruleId: json['ruleId'] as String,
      name: json['name'] as String,
      ruleType: _bonusRuleTypeFromApi(json['ruleType'] as String),
      tripThreshold: (json['tripThreshold'] as num).toInt(),
      bonusAmount: (json['bonusAmount'] as num).toDouble(),
      currentCount: (json['currentCount'] as num).toInt(),
    );
  }

  @override
  List<Object?> get props => [
        ruleId,
        name,
        ruleType,
        tripThreshold,
        bonusAmount,
        currentCount,
      ];
}
