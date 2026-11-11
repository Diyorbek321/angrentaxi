import 'package:equatable/equatable.dart';

// A single period's earnings figures, as returned per-period by
// GET /orders/earnings/breakdown
// (backend/src/modules/orders/orders.service.ts#getDriverEarningsForPeriod).
//
// `commission` is the actual commission DEBIT transaction summed per
// completed order in the period (not recomputed from the driver's current
// commission rate), so `net` stays accurate even if the rate changed since
// the trip happened. `net` = gross - commission - taxWithheld - shiftPassCost
// (docs/LEGAL-COMPLIANCE.md §9), computed server-side and NOT recomputed
// here. `taxWithheld` (1% aylanma solig'i) va `shiftPassCost` (davrda
// boshlangan smenalar) eski backendda yo'q — 0 deb olinadi.
//
// v4 (§22): `tips` — davrdagi yakunlangan safarlar chaqimi (komissiya va
// soliqsiz, to'liq hamyonga). `net` ma'nosi O'ZGARMAGAN (chaqim kirmaydi);
// `netWithTips = net + tips` — haydovchining jami sof tushumi. Eski server
// bermasa: tips = 0, netWithTips = net + tips.
class DriverEarningsPeriod extends Equatable {
  const DriverEarningsPeriod({
    this.gross = 0,
    this.commission = 0,
    this.taxWithheld = 0,
    this.shiftPassCost = 0,
    this.net = 0,
    this.trips = 0,
    this.tips = 0,
    double? netWithTips,
  }) : _netWithTips = netWithTips;

  final double gross;
  final double commission;
  final double taxWithheld;
  final double shiftPassCost;
  final double net;
  final int trips;

  /// Chaqim (komissiyasiz).
  final double tips;
  final double? _netWithTips;

  /// Jami sof tushum: yo'l haqidan sof + chaqim.
  double get netWithTips => _netWithTips ?? net + tips;

  /// Barcha ushlanmalar yig'indisi (komissiya + soliq + smena).
  double get totalDeductions => commission + taxWithheld + shiftPassCost;

  static const empty = DriverEarningsPeriod();

  factory DriverEarningsPeriod.fromJson(Map<String, dynamic> json) {
    return DriverEarningsPeriod(
      gross: (json['gross'] as num?)?.toDouble() ?? 0,
      commission: (json['commission'] as num?)?.toDouble() ?? 0,
      taxWithheld: (json['taxWithheld'] as num?)?.toDouble() ?? 0,
      shiftPassCost: (json['shiftPassCost'] as num?)?.toDouble() ?? 0,
      net: (json['net'] as num?)?.toDouble() ?? 0,
      trips: (json['trips'] as num?)?.toInt() ?? 0,
      tips: (json['tips'] as num?)?.toDouble() ?? 0,
      netWithTips: (json['netWithTips'] as num?)?.toDouble(),
    );
  }

  @override
  List<Object?> get props =>
      [gross, commission, taxWithheld, shiftPassCost, net, trips, tips, netWithTips];
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
