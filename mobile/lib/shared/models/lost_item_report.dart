import 'package:angren_taxi/l10n/l10n.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

enum LostItemStatus {
  open('open', Icons.hourglass_top_rounded),
  found('found', Icons.check_circle_outline),
  notFound('not_found', Icons.search_off_rounded),
  returned('returned', Icons.assignment_turned_in_outlined),
  closed('closed', Icons.lock_outline);

  const LostItemStatus(this.apiValue, this.icon);

  final String apiValue;
  String get label => switch (this) {
        LostItemStatus.open => AppL10n.current.shLostItemOpen,
        LostItemStatus.found => AppL10n.current.shLostItemFound,
        LostItemStatus.notFound => AppL10n.current.shLostItemNotFound,
        LostItemStatus.returned => AppL10n.current.shLostItemReturned,
        LostItemStatus.closed => AppL10n.current.shLostItemClosed,
      };
  final IconData icon;

  static LostItemStatus fromApi(Object? value) => LostItemStatus.values
      .firstWhere((s) => s.apiValue == value, orElse: () => LostItemStatus.open);
}

/// Safarda qoldirilgan buyum haqida xabar (`/lost-items`).
class LostItemReport extends Equatable {
  const LostItemReport({
    required this.id,
    required this.orderId,
    required this.description,
    required this.status,
    required this.createdAt,
    this.driverNote,
    this.operatorNote,
  });

  final String id;
  final String orderId;
  final String description;
  final LostItemStatus status;
  final String? driverNote;
  final String? operatorNote;
  final DateTime createdAt;

  /// Haydovchi hali javob bermagan.
  bool get awaitsDriver => status == LostItemStatus.open;

  factory LostItemReport.fromJson(Map<String, dynamic> json) => LostItemReport(
        id: json['id'] as String,
        orderId: json['orderId'] as String,
        description: (json['description'] as String?) ?? '',
        status: LostItemStatus.fromApi(json['status']),
        driverNote: json['driverNote'] as String?,
        operatorNote: json['operatorNote'] as String?,
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '')?.toLocal() ??
            DateTime.now(),
      );

  @override
  List<Object?> get props =>
      [id, orderId, description, status, driverNote, operatorNote, createdAt];
}
