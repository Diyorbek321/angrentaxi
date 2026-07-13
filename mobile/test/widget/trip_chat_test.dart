// Widget tests for the in-trip passenger<->driver chat
// (mobile/lib/features/trip/screens/trip_chat_screen.dart +
// mobile/lib/features/trip/trip_chat_provider.dart):
//
// - Sending a message calls POST /orders/:orderId/messages and appends the
//   server's response to the list locally.
// - A 'trip:message' socket event received while the screen is open (e.g.
//   the other party's reply, delivered live over the order's socket room)
//   appends the message to the list.
//
// ApiClient and SocketService are mocked with mocktail and injected into a
// real TripChatProvider, same pattern as test/widget/sos_button_test.dart
// (real service class backed by a mocked ApiClient).
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/trip/screens/trip_chat_screen.dart';
import 'package:angren_taxi/features/trip/trip_chat_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockSocketService extends Mock implements SocketService {}

const String _orderId = 'order-1';
const String _passengerId = 'passenger-1';
const String _driverId = 'driver-1';

Response<dynamic> _jsonResponse(String path, dynamic data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

Map<String, dynamic> _messageJson({
  required String id,
  required String senderId,
  required String senderRole,
  required String body,
}) =>
    {
      'id': id,
      'orderId': _orderId,
      'senderId': senderId,
      'senderRole': senderRole,
      'body': body,
      'createdAt': '2026-07-13T22:23:16.000Z',
    };

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late MockSocketService socketService;
  late TripChatProvider provider;
  void Function(dynamic)? capturedHandler;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() {
    apiClient = MockApiClient();
    socketService = MockSocketService();
    capturedHandler = null;

    when(() => socketService.on(any(), any())).thenAnswer((invocation) {
      capturedHandler =
          invocation.positionalArguments[1] as void Function(dynamic);
    });
    when(() => socketService.off(any())).thenAnswer((_) {});

    when(() => apiClient.get(ApiEndpoints.tripMessages(_orderId)))
        .thenAnswer((_) async => _jsonResponse(
              ApiEndpoints.tripMessages(_orderId),
              <Map<String, dynamic>>[],
            ));

    provider = TripChatProvider(
      apiClient: apiClient,
      socketService: socketService,
    );
  });

  Future<void> pumpChatScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: TripChatScreen(
          orderId: _orderId,
          currentUserId: _passengerId,
          chatProvider: provider,
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
    'sending a message calls POST /orders/:orderId/messages and appends it locally',
    (tester) async {
      when(() => apiClient.post(
            ApiEndpoints.tripMessages(_orderId),
            data: any(named: 'data'),
          )).thenAnswer(
        (_) async => _jsonResponse(
          ApiEndpoints.tripMessages(_orderId),
          _messageJson(
            id: 'msg-1',
            senderId: _passengerId,
            senderRole: 'passenger',
            body: 'Salom, men keldim',
          ),
        ),
      );

      await pumpChatScreen(tester);

      expect(find.text("Hali xabar yo'q. Birinchi bo'lib yozing!"),
          findsOneWidget);

      await tester.enterText(find.byType(TextField), 'Salom, men keldim');
      await tester.tap(find.byIcon(Icons.send_rounded));
      await tester.pumpAndSettle();

      final captured = verify(() => apiClient.post(
            ApiEndpoints.tripMessages(_orderId),
            data: captureAny(named: 'data'),
          )).captured.single as Map<String, dynamic>;
      expect(captured['body'], 'Salom, men keldim');

      expect(find.text('Salom, men keldim'), findsOneWidget);
    },
  );

  testWidgets(
    "a 'trip:message' socket event received while the screen is open appends the message to the list",
    (tester) async {
      await pumpChatScreen(tester);

      expect(find.text('Yaxshimisiz, men yo\'lda'), findsNothing);
      expect(capturedHandler, isNotNull);

      capturedHandler!(_messageJson(
        id: 'msg-2',
        senderId: _driverId,
        senderRole: 'driver',
        body: 'Yaxshimisiz, men yo\'lda',
      ));
      await tester.pumpAndSettle();

      expect(find.text('Yaxshimisiz, men yo\'lda'), findsOneWidget);
    },
  );
}
