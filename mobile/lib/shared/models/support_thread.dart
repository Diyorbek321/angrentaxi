import 'package:equatable/equatable.dart';

class SupportThread extends Equatable {
  const SupportThread({
    required this.id,
    required this.userId,
    required this.status,
    this.lastMessageAt,
  });

  final String id;
  final String userId;
  final String status; // 'open' | 'closed'
  final DateTime? lastMessageAt;

  bool get isClosed => status == 'closed';

  factory SupportThread.fromJson(Map<String, dynamic> json) => SupportThread(
        id: json['id'] as String,
        userId: json['userId'] as String,
        status: json['status'] as String? ?? 'open',
        lastMessageAt: json['lastMessageAt'] != null
            ? DateTime.tryParse(json['lastMessageAt'] as String)
            : null,
      );

  SupportThread copyWith({String? status, DateTime? lastMessageAt}) =>
      SupportThread(
        id: id,
        userId: userId,
        status: status ?? this.status,
        lastMessageAt: lastMessageAt ?? this.lastMessageAt,
      );

  @override
  List<Object?> get props => [id, userId, status, lastMessageAt];
}
