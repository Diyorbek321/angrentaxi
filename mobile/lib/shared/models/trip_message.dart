import 'package:equatable/equatable.dart';

/// In-trip passenger<->driver chat message.
///
/// Matches the shape returned by both `GET /orders/:orderId/messages` (array,
/// oldest-first) and `POST /orders/:orderId/messages` (single object), and
/// the `trip:message` socket event payload broadcast to the
/// `order:${orderId}` room — see
/// backend/src/modules/trip-chat/trip-chat.service.ts. No `sender`/`order`
/// relation objects are populated server-side, so display name/avatar for
/// [senderId] must be resolved from data already held elsewhere (the order's
/// passenger/driver), not from this model.
class TripMessage extends Equatable {
  const TripMessage({
    required this.id,
    required this.orderId,
    required this.senderId,
    required this.senderRole,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String orderId;
  final String senderId;
  final String senderRole; // 'passenger' | 'driver'
  final String body;
  final DateTime createdAt;

  factory TripMessage.fromJson(Map<String, dynamic> json) => TripMessage(
        id: json['id'] as String,
        orderId: json['orderId'] as String,
        senderId: json['senderId'] as String,
        senderRole: json['senderRole'] as String,
        body: json['body'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );

  @override
  List<Object?> get props =>
      [id, orderId, senderId, senderRole, body, createdAt];
}
