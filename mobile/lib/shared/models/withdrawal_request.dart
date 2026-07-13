import 'package:equatable/equatable.dart';

// Mirrors backend `WithdrawalRequest` status enum
// (backend/src/database/entities/withdrawal-request.entity.ts).
enum WithdrawalStatus { pending, approved, rejected, paid }

WithdrawalStatus withdrawalStatusFromApi(String value) {
  switch (value) {
    case 'approved':
      return WithdrawalStatus.approved;
    case 'rejected':
      return WithdrawalStatus.rejected;
    case 'paid':
      return WithdrawalStatus.paid;
    case 'pending':
    default:
      return WithdrawalStatus.pending;
  }
}

// A driver payout request as returned by POST/GET
// /payments/wallet/withdraw(als).
class WithdrawalRequest extends Equatable {
  const WithdrawalRequest({
    required this.id,
    required this.driverId,
    required this.amount,
    required this.status,
    required this.payoutDestination,
    required this.requestedAt,
    this.processedAt,
    this.adminNote,
  });

  final String id;
  final String driverId;
  final double amount;
  final WithdrawalStatus status;
  final String payoutDestination;
  final DateTime requestedAt;
  final DateTime? processedAt;
  final String? adminNote;

  factory WithdrawalRequest.fromJson(Map<String, dynamic> json) {
    return WithdrawalRequest(
      id: json['id'] as String,
      driverId: json['driverId'] as String,
      amount: (json['amount'] as num).toDouble(),
      status: withdrawalStatusFromApi(json['status'] as String),
      payoutDestination: json['payoutDestination'] as String,
      requestedAt: DateTime.parse(json['requestedAt'] as String),
      processedAt: json['processedAt'] != null
          ? DateTime.parse(json['processedAt'] as String)
          : null,
      adminNote: json['adminNote'] as String?,
    );
  }

  @override
  List<Object?> get props => [
        id,
        driverId,
        amount,
        status,
        payoutDestination,
        requestedAt,
        processedAt,
        adminNote,
      ];
}
