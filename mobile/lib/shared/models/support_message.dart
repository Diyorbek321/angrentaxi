import 'package:equatable/equatable.dart';

class SupportMessage extends Equatable {
  const SupportMessage({
    required this.id,
    required this.threadId,
    required this.senderId,
    required this.senderRole,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String threadId;
  final String senderId;
  final String senderRole; // 'passenger' | 'driver' | 'manager' | 'admin'
  final String body;
  final DateTime createdAt;

  bool get isFromOperator => senderRole == 'manager' || senderRole == 'admin';

  factory SupportMessage.fromJson(Map<String, dynamic> json) => SupportMessage(
        id: json['id'] as String,
        threadId: json['threadId'] as String,
        senderId: json['senderId'] as String,
        senderRole: json['senderRole'] as String,
        body: json['body'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  @override
  List<Object?> get props =>
      [id, threadId, senderId, senderRole, body, createdAt];
}
