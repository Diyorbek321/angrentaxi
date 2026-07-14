// Widget tests for the active promo codes list
// (mobile/lib/features/superapp/screens/promos_screen.dart), backed by
// backend/src/modules/promo-codes:
//   GET /promo-codes/active
//
// ApiClient is mocked with mocktail — no real network call is made — same
// pattern as test/widget/referral_screen_test.dart.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/screens/promos_screen.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, dynamic data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

const List<Map<String, dynamic>> _activePromoCodesJson = [
  {
    'id': 'promo-1',
    'code': 'SUMMER10',
    'discountPercent': 10,
    'discountFixed': null,
    'maxUses': 100,
    'usedCount': 5,
    'minOrderAmount': 20000,
    'expiresAt': '2026-08-01T00:00:00.000Z',
    'isActive': true,
    'createdAt': '2026-07-10T12:00:00.000Z',
    'updatedAt': '2026-07-10T12:00:00.000Z',
  },
  {
    'id': 'promo-2',
    'code': 'FIXED15',
    'discountPercent': null,
    'discountFixed': 15000,
    'maxUses': null,
    'usedCount': 0,
    'minOrderAmount': 0,
    'expiresAt': null,
    'isActive': true,
    'createdAt': '2026-07-09T12:00:00.000Z',
    'updatedAt': '2026-07-09T12:00:00.000Z',
  },
];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await initializeDateFormatting('uz', null);
  });

  late MockApiClient apiClient;
  late List<MethodCall> clipboardCalls;

  setUp(() {
    apiClient = MockApiClient();
    clipboardCalls = [];

    TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'Clipboard.setData') {
        clipboardCalls.add(call);
      }
      return null;
    });
  });

  tearDown(() {
    TestWidgetsFlutterBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null);
  });

  Future<void> pumpPromosScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      MaterialApp(home: PromosScreen(apiClient: apiClient)),
    );
    await tester.pumpAndSettle();
  }

  testWidgets(
      'renders the fetched active promo codes with correct discount text',
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.activePromoCodes)).thenAnswer(
      (_) async => _jsonResponse(
          ApiEndpoints.activePromoCodes, _activePromoCodesJson),
    );

    await pumpPromosScreen(tester);

    expect(find.text('SUMMER10'), findsOneWidget);
    expect(find.text('-10%'), findsOneWidget);
    expect(
      find.text("Min. buyurtma: ${Formatters.formatSom(20000)} · 01.08.2026gacha"),
      findsOneWidget,
    );

    expect(find.text('FIXED15'), findsOneWidget);
    expect(find.text('-${Formatters.formatSom(15000)}'), findsOneWidget);
  });

  testWidgets('shows an empty state when there are no active promo codes',
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.activePromoCodes)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.activePromoCodes, <dynamic>[]),
    );

    await pumpPromosScreen(tester);

    expect(find.text("Hozircha faol promokodlar yo'q"), findsOneWidget);
  });

  testWidgets('tapping a promo code copies it to the clipboard',
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.activePromoCodes)).thenAnswer(
      (_) async => _jsonResponse(
          ApiEndpoints.activePromoCodes, _activePromoCodesJson),
    );

    await pumpPromosScreen(tester);

    await tester.tap(find.text('SUMMER10'));
    await tester.pumpAndSettle();

    final setDataCall = clipboardCalls.firstWhere(
      (call) => call.method == 'Clipboard.setData',
    );
    expect((setDataCall.arguments as Map)['text'], 'SUMMER10');
    expect(find.text('Kod nusxalandi'), findsOneWidget);
  });

  testWidgets('a failed GET /promo-codes/active shows an error with retry',
      (tester) async {
    when(() => apiClient.get(ApiEndpoints.activePromoCodes)).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: ApiEndpoints.activePromoCodes),
        type: DioExceptionType.connectionError,
      ),
    );

    await pumpPromosScreen(tester);

    expect(find.text('Qayta urinish'), findsOneWidget);
    expect(find.text('SUMMER10'), findsNothing);
  });
}
