// Widget tests for the star-rating breakdown bar chart added below the
// headline rating on DriverProfileScreen, backed by
// GET /ratings/driver/:userId. ApiClient is mocked with mocktail; pattern
// mirrors driver_wallet_withdraw_test.dart.
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/profile_screen.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: data,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient mockApiClient;
  late LocalStorage localStorage;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: '/'));
  });

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    localStorage = LocalStorage(prefs);
    mockApiClient = MockApiClient();

    when(() => mockApiClient.get(ApiEndpoints.driverProfile)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverProfile, {
        'success': true,
        'data': {
          'id': 'driver-1',
          'carModel': 'Chevrolet Cobalt',
          'carColor': 'Oq',
          'carNumber': '01 A 123 BC',
          'rating': 4.5,
          'totalTrips': 42,
          'balance': 50000,
          'user': {'id': 'user-1', 'phone': '+998901112233', 'status': 'approved'},
        },
      }),
    );
  });

  Future<void> pumpUntilQuiet(WidgetTester tester, {int times = 15}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  Future<void> pumpProfileScreen(WidgetTester tester) async {
    final driverProvider = DriverProvider(
      apiClient: mockApiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: localStorage,
    );
    final authProvider = AuthProvider(
      apiClient: mockApiClient,
      localStorage: localStorage,
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DriverProvider>.value(value: driverProvider),
          ChangeNotifierProvider<AuthProvider>.value(value: authProvider),
        ],
        child: const MaterialApp(home: DriverProfileScreen()),
      ),
    );

    await pumpUntilQuiet(tester);
  }

  testWidgets(
      'renders all 5 breakdown rows sized by share of the highest bucket',
      (tester) async {
    when(() => mockApiClient.get(ApiEndpoints.driverRatingStats('user-1')))
        .thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverRatingStats('user-1'), {
        'success': true,
        'data': {
          'avg': 4.5,
          'count': 10,
          'breakdown': {'1': 0, '2': 1, '3': 1, '4': 2, '5': 6},
        },
      }),
    );

    await pumpProfileScreen(tester);

    expect(find.byKey(const ValueKey('rating_breakdown')), findsOneWidget);
    expect(find.text('10 ta baholash'), findsOneWidget);

    for (var star = 1; star <= 5; star++) {
      expect(
        find.byKey(ValueKey('rating_bar_row_$star')),
        findsOneWidget,
        reason: 'row for $star stars should render',
      );
    }

    expect(
      (tester.widget(find.byKey(const ValueKey('rating_bar_count_5'))) as Text)
          .data,
      '6',
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('rating_bar_count_4'))) as Text)
          .data,
      '2',
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('rating_bar_count_3'))) as Text)
          .data,
      '1',
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('rating_bar_count_2'))) as Text)
          .data,
      '1',
    );
    expect(
      (tester.widget(find.byKey(const ValueKey('rating_bar_count_1'))) as Text)
          .data,
      '0',
    );

    // The 5-star bucket has the highest count (6), so its bar should be at
    // full fraction (1.0) and the 1-star bucket (0 ratings) at 0.
    final fiveStarBar = tester.widgetList<LinearProgressIndicator>(
      find.descendant(
        of: find.byKey(const ValueKey('rating_bar_row_5')),
        matching: find.byType(LinearProgressIndicator),
      ),
    ).single;
    expect(fiveStarBar.value, 1.0);

    final oneStarBar = tester.widgetList<LinearProgressIndicator>(
      find.descendant(
        of: find.byKey(const ValueKey('rating_bar_row_1')),
        matching: find.byType(LinearProgressIndicator),
      ),
    ).single;
    expect(oneStarBar.value, 0.0);
  });

  testWidgets('the breakdown section is hidden when the driver has no ratings',
      (tester) async {
    when(() => mockApiClient.get(ApiEndpoints.driverRatingStats('user-1')))
        .thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.driverRatingStats('user-1'), {
        'success': true,
        'data': {
          'avg': 0,
          'count': 0,
          'breakdown': {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0},
        },
      }),
    );

    await pumpProfileScreen(tester);

    expect(find.byKey(const ValueKey('rating_breakdown')), findsNothing);
  });
}
