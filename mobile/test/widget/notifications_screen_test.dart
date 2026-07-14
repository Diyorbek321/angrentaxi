// Widget tests for NotificationsScreen wired to real
// GET /notifications / PATCH /notifications/:id/read / POST
// /notifications/read-all (mobile/lib/features/superapp/screens/notifications_screen.dart),
// replacing the previously hardcoded static `_items` list.
//
// ApiClient is mocked with mocktail, same pattern as
// test/widget/favorites_home_test.dart.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/notifications/notifications_provider.dart';
import 'package:angren_taxi/features/superapp/screens/notifications_screen.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, dynamic data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

final List<Map<String, dynamic>> _notificationsJson = [
  {
    'id': 'notif-1',
    'userId': 'passenger-1',
    'title': "−30% birinchi safaringizga",
    'body': 'ANGREN30 promokodidan foydalaning',
    'event': 'order_accepted',
    'read': false,
    'createdAt': DateTime.now().subtract(const Duration(minutes: 5)).toIso8601String(),
  },
  {
    'id': 'notif-2',
    'userId': 'passenger-1',
    'title': 'Safaringiz yakunlandi',
    'body': "Bobur A. · 18 000 so'm. Baholang!",
    'event': 'trip_completed',
    'read': true,
    'createdAt': DateTime.now().subtract(const Duration(days: 1)).toIso8601String(),
  },
];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await initializeDateFormatting('uz', null);
  });

  late MockApiClient apiClient;
  late NotificationsProvider notificationsProvider;

  setUp(() {
    apiClient = MockApiClient();
    notificationsProvider = NotificationsProvider(apiClient: apiClient);

    when(() => apiClient.get(ApiEndpoints.notifications)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.notifications, _notificationsJson),
    );
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<NotificationsProvider>.value(
        value: notificationsProvider,
        child: const MaterialApp(home: NotificationsScreen()),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('fetches and renders the real notification list', (tester) async {
    await pumpScreen(tester);

    expect(find.text('−30% birinchi safaringizga'), findsOneWidget);
    expect(find.text('Safaringiz yakunlandi'), findsOneWidget);
    expect(find.text('ANGREN30 promokodidan foydalaning'), findsOneWidget);
  });

  testWidgets('tapping an unread notification calls markRead for its id',
      (tester) async {
    when(() => apiClient.patch(ApiEndpoints.markNotificationRead('notif-1')))
        .thenAnswer(
      (_) async => _jsonResponse(
        ApiEndpoints.markNotificationRead('notif-1'),
        {..._notificationsJson[0], 'read': true},
      ),
    );

    await pumpScreen(tester);

    expect(notificationsProvider.notifications.first.read, false);

    await tester.tap(find.text('−30% birinchi safaringizga'));
    await tester.pumpAndSettle();

    verify(() => apiClient.patch(ApiEndpoints.markNotificationRead('notif-1')))
        .called(1);
    expect(notificationsProvider.notifications.first.read, true);
  });

  testWidgets('tapping an already-read notification does not call markRead',
      (tester) async {
    await pumpScreen(tester);

    await tester.tap(find.text('Safaringiz yakunlandi'));
    await tester.pumpAndSettle();

    verifyNever(() => apiClient.patch(ApiEndpoints.markNotificationRead('notif-2')));
  });

  testWidgets("tapping O'qildi calls markAllRead and clears the unread state",
      (tester) async {
    when(() => apiClient.post(ApiEndpoints.markAllNotificationsRead))
        .thenAnswer(
      (_) async =>
          _jsonResponse(ApiEndpoints.markAllNotificationsRead, {'updated': 1}),
    );

    await pumpScreen(tester);

    expect(notificationsProvider.unreadCount, 1);

    await tester.tap(find.text("O'qildi"));
    await tester.pumpAndSettle();

    verify(() => apiClient.post(ApiEndpoints.markAllNotificationsRead))
        .called(1);
    expect(notificationsProvider.unreadCount, 0);
  });

  testWidgets('shows an empty state when there are no notifications',
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.notifications)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.notifications, <dynamic>[]),
    );

    await pumpScreen(tester);

    expect(find.text("Hozircha bildirishnomalar yo'q"), findsOneWidget);
  });
}
