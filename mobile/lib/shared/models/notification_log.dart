import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:equatable/equatable.dart';
import 'package:flutter/material.dart';

/// Mirrors the backend's `NotificationLog.event` values
/// (backend/src/modules/notifications/notifications.service.ts
/// `logNotification()` call sites). `unknown` is a client-only fallback for
/// any value the backend adds later that this build doesn't know about yet.
enum NotificationEvent {
  orderAccepted,
  driverArrived,
  tripCompleted,
  newOrderOffer,
  orderCancelled,
  supportReply,
  unknown,
}

NotificationEvent _notificationEventFromString(String value) {
  switch (value) {
    case 'order_accepted':
      return NotificationEvent.orderAccepted;
    case 'driver_arrived':
      return NotificationEvent.driverArrived;
    case 'trip_completed':
      return NotificationEvent.tripCompleted;
    case 'new_order_offer':
      return NotificationEvent.newOrderOffer;
    case 'order_cancelled':
      return NotificationEvent.orderCancelled;
    case 'support_reply':
      return NotificationEvent.supportReply;
    default:
      return NotificationEvent.unknown;
  }
}

/// A single persisted notification, backed by
/// `GET /notifications` / `PATCH /notifications/:id/read` / `POST
/// /notifications/read-all` (backend/src/modules/notifications). The
/// backend's `NotificationLog` also carries a `userId`, kept here even
/// though the UI never displays it since it's part of the wire shape.
class NotificationLog extends Equatable {
  const NotificationLog({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    required this.event,
    required this.read,
    required this.createdAt,
  });

  final String id;
  final String userId;
  final String title;
  final String body;
  final NotificationEvent event;
  final bool read;
  final DateTime createdAt;

  factory NotificationLog.fromJson(Map<String, dynamic> json) {
    return NotificationLog(
      id: json['id'] as String,
      userId: (json['userId'] as String?) ?? '',
      title: (json['title'] as String?) ?? '',
      body: (json['body'] as String?) ?? '',
      event: _notificationEventFromString(json['event'] as String? ?? ''),
      read: (json['read'] as bool?) ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  NotificationLog copyWith({bool? read}) {
    return NotificationLog(
      id: id,
      userId: userId,
      title: title,
      body: body,
      event: event,
      read: read ?? this.read,
      createdAt: createdAt,
    );
  }

  @override
  List<Object?> get props =>
      [id, userId, title, body, event, read, createdAt];
}

/// Icon/color picked from `event` so the notifications list keeps the
/// existing per-type card look (redeem/taxi/food/wallet) without the backend
/// needing to store presentation data.
extension NotificationLogPresentation on NotificationLog {
  IconData get icon {
    switch (event) {
      case NotificationEvent.orderAccepted:
      case NotificationEvent.newOrderOffer:
        return Icons.local_taxi_rounded;
      case NotificationEvent.driverArrived:
        return Icons.pin_drop_rounded;
      case NotificationEvent.tripCompleted:
        return Icons.flag_rounded;
      case NotificationEvent.orderCancelled:
        return Icons.cancel_rounded;
      case NotificationEvent.supportReply:
        return Icons.support_agent_rounded;
      case NotificationEvent.unknown:
        return Icons.notifications_rounded;
    }
  }

  Color get iconBgColor {
    switch (event) {
      case NotificationEvent.orderAccepted:
      case NotificationEvent.newOrderOffer:
      case NotificationEvent.tripCompleted:
        return agTint;
      case NotificationEvent.driverArrived:
        return agTint;
      case NotificationEvent.orderCancelled:
        return kErrorLight;
      case NotificationEvent.supportReply:
        return kInfoLight;
      case NotificationEvent.unknown:
        return agBg;
    }
  }

  Color get iconColor {
    switch (event) {
      case NotificationEvent.orderAccepted:
      case NotificationEvent.newOrderOffer:
      case NotificationEvent.tripCompleted:
      case NotificationEvent.driverArrived:
        return agGreen;
      case NotificationEvent.orderCancelled:
        return agRed;
      case NotificationEvent.supportReply:
        return agBlue;
      case NotificationEvent.unknown:
        return agSubtle;
    }
  }
}
