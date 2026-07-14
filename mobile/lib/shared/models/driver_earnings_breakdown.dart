import 'package:equatable/equatable.dart';

// A single period's earnings figures, as returned per-period by
// GET /orders/earnings/breakdown
// (backend/src/modules/orders/orders.service.ts#getDriverEarningsForPeriod).
//
// `commission` is the actual commission DEBIT transaction summed per
// completed order in the period (not recomputed from the driver's current
// commission rate), so `net` stays accurate even if the rate changed since
// the trip happened. `net` = gross - commission (also computed server-side,
// not recomputed here).
class DriverEarningsPeriod extends Equatable {
  const DriverEarningsPeriod({
    this.gross = 0,
    this.commission = 0,
    this.net = 0,
    this.trips = 0,
  });

  final double gross;
  final double commission;
  final double net;
  final int trips;

  static const empty = DriverEarningsPeriod();

  factory DriverEarningsPeriod.fromJson(Map<String, dynamic> json) {
    return DriverEarningsPeriod(
      gross: (json['gross'] as num?)?.toDouble() ?? 0,
      commission: (json['commission'] as num?)?.toDouble() ?? 0,
      net: (json['net'] as num?)?.toDouble() ?? 0,
      trips: (json['trips'] as num?)?.toInt() ?? 0,
    );
  }

  @override
  List<Object?> get props => [gross, commission, net, trips];
}

// GET /orders/earnings/breakdown response — today / last-7-days /
// last-30-days rolling windows (see orders.controller.ts /
// orders.service.ts#getDriverEarningsBreakdown). Distinct from the older
// GET /orders/earnings, which only returns `{ today: number }` and is kept
// around unchanged for the earnings screen's headline figure.
class DriverEarningsBreakdown extends Equatable {
  const DriverEarningsBreakdown({
    this.today = DriverEarningsPeriod.empty,
    this.week = DriverEarningsPeriod.empty,
    this.month = DriverEarningsPeriod.empty,
  });

  final DriverEarningsPeriod today;
  final DriverEarningsPeriod week;
  final DriverEarningsPeriod month;

  static const empty = DriverEarningsBreakdown();

  factory DriverEarningsBreakdown.fromJson(Map<String, dynamic> json) {
    return DriverEarningsBreakdown(
      today: json['today'] != null
          ? DriverEarningsPeriod.fromJson(
              json['today'] as Map<String, dynamic>)
          : DriverEarningsPeriod.empty,
      week: json['week'] != null
          ? DriverEarningsPeriod.fromJson(json['week'] as Map<String, dynamic>)
          : DriverEarningsPeriod.empty,
      month: json['month'] != null
          ? DriverEarningsPeriod.fromJson(
              json['month'] as Map<String, dynamic>)
          : DriverEarningsPeriod.empty,
    );
  }

  @override
  List<Object?> get props => [today, week, month];
}
