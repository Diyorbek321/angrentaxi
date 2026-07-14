// Model tests for NotificationLog.fromJson (backend/src/modules/notifications
// — NotificationLog entity), plus the icon/color presentation heuristic
// derived from the `event` field.
import 'package:angren_taxi/shared/models/notification_log.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('NotificationLog.fromJson', () {
    test('parses a full notification response', () {
      final notification = NotificationLog.fromJson({
        'id': 'notif-1',
        'userId': 'user-1',
        'title': 'Safaringiz yakunlandi',
        'body': "Bobur A. · 18 000 so'm. Baholang!",
        'event': 'trip_completed',
        'read': false,
        'createdAt': '2026-07-14T10:00:00.000Z',
      });

      expect(notification.id, 'notif-1');
      expect(notification.userId, 'user-1');
      expect(notification.title, 'Safaringiz yakunlandi');
      expect(notification.body, "Bobur A. · 18 000 so'm. Baholang!");
      expect(notification.event, NotificationEvent.tripCompleted);
      expect(notification.read, false);
      expect(notification.createdAt, DateTime.parse('2026-07-14T10:00:00.000Z'));
    });

    test('maps every backend event string to its enum value', () {
      const cases = {
        'order_accepted': NotificationEvent.orderAccepted,
        'driver_arrived': NotificationEvent.driverArrived,
        'trip_completed': NotificationEvent.tripCompleted,
        'new_order_offer': NotificationEvent.newOrderOffer,
        'order_cancelled': NotificationEvent.orderCancelled,
        'support_reply': NotificationEvent.supportReply,
      };

      for (final entry in cases.entries) {
        final notification = NotificationLog.fromJson({
          'id': 'notif-x',
          'title': 't',
          'body': 'b',
          'event': entry.key,
          'read': false,
          'createdAt': '2026-07-14T10:00:00.000Z',
        });
        expect(notification.event, entry.value, reason: entry.key);
      }
    });

    test('unrecognized event string falls back to unknown', () {
      final notification = NotificationLog.fromJson({
        'id': 'notif-2',
        'title': 't',
        'body': 'b',
        'event': 'something_new',
        'read': false,
        'createdAt': '2026-07-14T10:00:00.000Z',
      });

      expect(notification.event, NotificationEvent.unknown);
    });

    test('defaults userId/title/body/read when absent', () {
      final notification = NotificationLog.fromJson({
        'id': 'notif-3',
        'event': 'order_accepted',
        'createdAt': '2026-07-14T10:00:00.000Z',
      });

      expect(notification.userId, '');
      expect(notification.title, '');
      expect(notification.body, '');
      expect(notification.read, false);
    });

    test('two notifications with the same fields are equal (Equatable)', () {
      final a = NotificationLog.fromJson({
        'id': 'notif-1',
        'userId': 'user-1',
        'title': 't',
        'body': 'b',
        'event': 'order_accepted',
        'read': false,
        'createdAt': '2026-07-14T10:00:00.000Z',
      });
      final b = NotificationLog.fromJson({
        'id': 'notif-1',
        'userId': 'user-1',
        'title': 't',
        'body': 'b',
        'event': 'order_accepted',
        'read': false,
        'createdAt': '2026-07-14T10:00:00.000Z',
      });

      expect(a, b);
    });

    test('copyWith(read: true) flips read without touching other fields', () {
      final notification = NotificationLog.fromJson({
        'id': 'notif-1',
        'userId': 'user-1',
        'title': 't',
        'body': 'b',
        'event': 'order_accepted',
        'read': false,
        'createdAt': '2026-07-14T10:00:00.000Z',
      });

      final read = notification.copyWith(read: true);

      expect(read.read, true);
      expect(read.id, notification.id);
      expect(read.title, notification.title);
    });
  });

  group('NotificationLogPresentation', () {
    NotificationLog withEvent(NotificationEvent event) => NotificationLog(
          id: '1',
          userId: 'u',
          title: 't',
          body: 'b',
          event: event,
          read: false,
          createdAt: DateTime(2026, 7, 14),
        );

    test('trip_completed gets a flag icon', () {
      expect(
        withEvent(NotificationEvent.tripCompleted).icon,
        Icons.flag_rounded,
      );
    });

    test('order_cancelled gets a cancel icon', () {
      expect(
        withEvent(NotificationEvent.orderCancelled).icon,
        Icons.cancel_rounded,
      );
    });

    test('support_reply gets a support-agent icon', () {
      expect(
        withEvent(NotificationEvent.supportReply).icon,
        Icons.support_agent_rounded,
      );
    });

    test('unknown falls back to a generic bell icon', () {
      expect(
        withEvent(NotificationEvent.unknown).icon,
        Icons.notifications_rounded,
      );
    });
  });
}
