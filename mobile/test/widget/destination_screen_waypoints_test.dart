// Widget tests for the multi-stop ("To'xtash qo'shish") flow added to
// DestinationScreen (mobile/lib/features/passenger/screens/destination_screen.dart):
// tapping the add-stop tile opens map_picker_screen.dart, confirming a pin
// there calls OrderProvider.addWaypoint and pops back to DestinationScreen
// (not to the tariff screen), and the picked stop shows up in a removable
// list between the pickup row and the search field.
//
// ApiClient is mocked with mocktail, same pattern as
// test/widget/favorites_home_test.dart. The real MapPickerScreen is pushed
// (rather than faked via a route override) since DestinationScreen pushes it
// directly with a MaterialPageRoute — its FlutterMap tile layer and the
// geocoding plugin's reverse-geocode call both fail harmlessly under plain
// `flutter test` (no network, no platform channel), so this mirrors
// test/widget/sos_button_test.dart's bounded pump() loops instead of
// pumpAndSettle() plus tester.takeException() to drain that noise.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/favorites_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/passenger/screens/destination_screen.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late OrderProvider orderProvider;
  late FavoritesProvider favoritesProvider;

  setUp(() {
    apiClient = MockApiClient();
    orderProvider =
        OrderProvider(apiClient: apiClient, socketService: SocketService());
    favoritesProvider = FavoritesProvider(apiClient: apiClient);

    // Already resolved (not the "Joylashuv aniqlanmoqda..." placeholder) so
    // DestinationScreen's initState doesn't kick off its own reverse-geocode
    // call for the pickup row.
    orderProvider.setPendingPickup(
      const OrderLocation(
        address: "Angren, Bobur ko'chasi, 10",
        lat: 41.0167,
        lng: 70.1436,
      ),
    );

    when(() => apiClient.get(ApiEndpoints.favoriteAddresses)).thenAnswer(
      (_) async => _jsonResponse(ApiEndpoints.favoriteAddresses, <dynamic>[]),
    );
  });

  Future<void> pumpDestinationScreen(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<OrderProvider>.value(value: orderProvider),
          ChangeNotifierProvider<FavoritesProvider>.value(
            value: favoritesProvider,
          ),
        ],
        child: const MaterialApp(home: DestinationScreen()),
      ),
    );
    for (var i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  /// Drains the pending microtasks/frames without pumpAndSettle(), which
  /// never completes while flutter_map's tile layer keeps retrying real
  /// (failing) network image loads under `flutter test`.
  Future<void> pumpBounded(WidgetTester tester, {int times = 10}) async {
    for (var i = 0; i < times; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets(
    "tapping To'xtash qo'shish, picking a stop, adds it to the waypoints "
    'list with a working remove button',
    (tester) async {
      await pumpDestinationScreen(tester);

      expect(orderProvider.pendingWaypoints, isEmpty);
      expect(find.text("To'xtash qo'shish"), findsOneWidget);

      await tester.tap(find.text("To'xtash qo'shish"));
      await pumpBounded(tester);

      // Now on MapPickerScreen, titled for the stop (not "Qayerga").
      expect(find.text("To'xtash nuqtasi"), findsOneWidget);

      // Reverse-geocoding fails harmlessly under `flutter test` (no
      // platform channel), landing on this fallback address — give it a
      // moment to settle past its try/catch.
      await pumpBounded(tester);

      final confirmButton = find.widgetWithText(
        ElevatedButton,
        'Shu joyni tanlash',
      );
      expect(confirmButton, findsOneWidget);
      await tester.tap(confirmButton);
      await pumpBounded(tester);

      // Back on DestinationScreen (not the tariff screen) with the stop
      // recorded on OrderProvider and shown in the waypoints list.
      expect(find.text("To'xtash nuqtasi"), findsNothing);
      expect(find.text("To'xtash qo'shish"), findsOneWidget);
      expect(orderProvider.pendingWaypoints, hasLength(1));

      final waypointAddress = orderProvider.pendingWaypoints.first.address;
      expect(find.text(waypointAddress), findsOneWidget);
      // First waypoint is numbered "2" (pickup is the implicit "1").
      expect(find.text('2'), findsOneWidget);

      // Remove it via the trailing close icon.
      await tester.tap(find.byIcon(Icons.close_rounded));
      await pumpBounded(tester);

      expect(orderProvider.pendingWaypoints, isEmpty);
      expect(find.text(waypointAddress), findsNothing);

      tester.takeException();
    },
  );

  testWidgets(
    "the add-stop tile is hidden once OrderProvider.maxWaypoints is reached",
    (tester) async {
      for (var i = 0; i < OrderProvider.maxWaypoints; i++) {
        orderProvider.addWaypoint(
          OrderLocation(address: 'Stop $i', lat: 41.0 + i, lng: 70.0 + i),
        );
      }

      await pumpDestinationScreen(tester);

      expect(find.text("To'xtash qo'shish"), findsNothing);
      expect(orderProvider.pendingWaypoints, hasLength(OrderProvider.maxWaypoints));

      tester.takeException();
    },
  );

  testWidgets(
    "the add-stop tile is hidden in isSavingFavorite mode",
    (tester) async {
      await tester.pumpWidget(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<OrderProvider>.value(value: orderProvider),
            ChangeNotifierProvider<FavoritesProvider>.value(
              value: favoritesProvider,
            ),
          ],
          child: const MaterialApp(
            home: DestinationScreen(isSavingFavorite: true),
          ),
        ),
      );
      await pumpBounded(tester);

      expect(find.text("To'xtash qo'shish"), findsNothing);

      tester.takeException();
    },
  );
}
