import 'package:equatable/equatable.dart';

enum TransactionType { trip, topUp, withdrawal, bonus }

extension TransactionTypeExtension on TransactionType {
  String get label {
    switch (this) {
      case TransactionType.trip:
        return 'Sayohat';
      case TransactionType.topUp:
        return 'Hisobni to\'ldirish';
      case TransactionType.withdrawal:
        return 'Pul yechish';
      case TransactionType.bonus:
        return 'Bonus';
    }
  }
}

TransactionType transactionTypeFromString(String type) {
  switch (type) {
    case 'trip':
      return TransactionType.trip;
    case 'top_up':
      return TransactionType.topUp;
    case 'withdrawal':
      return TransactionType.withdrawal;
    case 'bonus':
      return TransactionType.bonus;
    default:
      return TransactionType.trip;
  }
}

class Transaction extends Equatable {
  const Transaction({
    required this.id,
    required this.amount,
    required this.type,
    required this.createdAt,
    this.orderId,
    this.description,
    this.isCredit = false,
  });

  final String id;
  final double amount;
  final TransactionType type;
  final DateTime createdAt;
  final String? orderId;
  final String? description;
  final bool isCredit;

  factory Transaction.fromJson(Map<String, dynamic> json) {
    return Transaction(
      id: json['id'] as String,
      amount: (json['amount'] as num).toDouble(),
      type: transactionTypeFromString(json['type'] as String),
      createdAt: DateTime.parse(json['createdAt'] as String),
      orderId: json['orderId'] as String?,
      description: json['description'] as String?,
      isCredit: (json['isCredit'] as bool?) ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'amount': amount,
    'type': type.name,
    'createdAt': createdAt.toIso8601String(),
    'orderId': orderId,
    'description': description,
    'isCredit': isCredit,
  };

  @override
  List<Object?> get props => [
    id,
    amount,
    type,
    createdAt,
    orderId,
    description,
    isCredit,
  ];
}
