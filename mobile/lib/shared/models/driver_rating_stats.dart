import 'package:equatable/equatable.dart';

// GET /ratings/driver/:userId response (backend/src/modules/ratings/
// ratings.service.ts#getDriverRatingStats / `DriverRatingStats`). `breakdown`
// maps star count (1..5) to how many ratings the driver received at that
// star count; backend always returns all five keys (0-filled).
class DriverRatingStats extends Equatable {
  const DriverRatingStats({
    this.avg = 0,
    this.count = 0,
    this.breakdown = const {5: 0, 4: 0, 3: 0, 2: 0, 1: 0},
  });

  final double avg;
  final int count;
  final Map<int, int> breakdown;

  static const empty = DriverRatingStats();

  // Highest count across all star buckets — used as the denominator when
  // sizing each breakdown row's bar relative to the others.
  int get maxBreakdownCount =>
      breakdown.values.fold(0, (max, v) => v > max ? v : max);

  factory DriverRatingStats.fromJson(Map<String, dynamic> json) {
    final rawBreakdown = json['breakdown'] as Map<String, dynamic>? ?? {};
    final breakdown = <int, int>{};
    for (final entry in rawBreakdown.entries) {
      final star = int.tryParse(entry.key);
      if (star != null) {
        breakdown[star] = (entry.value as num?)?.toInt() ?? 0;
      }
    }
    // Ensure all five star buckets are always present, even if the backend
    // response is missing one (defensive — backend currently always sends
    // all five).
    for (var star = 1; star <= 5; star++) {
      breakdown.putIfAbsent(star, () => 0);
    }
    return DriverRatingStats(
      avg: (json['avg'] as num?)?.toDouble() ?? 0,
      count: (json['count'] as num?)?.toInt() ?? 0,
      breakdown: breakdown,
    );
  }

  @override
  List<Object?> get props => [avg, count, breakdown];
}
