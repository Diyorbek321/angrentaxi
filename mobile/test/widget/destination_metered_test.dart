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

void main() {
  late MockApiClient api;
  late OrderProvider orders;

  setUp(() {
    api = MockApiClient();
    orders = OrderProvider(apiClient: api, socketService: SocketService());
    orders.setPendingPickup(const OrderLocation(address: 'Markaz', lat: 41.0167, lng: 70.1436));
    when(() => api.get(ApiEndpoints.favoriteAddresses)).thenAnswer((_) async => Response<dynamic>(
          requestOptions: RequestOptions(path: ApiEndpoints.favoriteAddresses),
          data: {'success': true, 'data': <dynamic>[]},
          statusCode: 200,
        ));
  });

  Future<void> pump(WidgetTester tester) async {
    await tester.pumpWidget(MultiProvider(
      providers: [
        ChangeNotifierProvider<OrderProvider>.value(value: orders),
        ChangeNotifierProvider<FavoritesProvider>.value(value: FavoritesProvider(apiClient: api)),
      ],
      child: MaterialApp(
        home: const DestinationScreen(),
        routes: {'/passenger/tariff': (_) => const Scaffold(body: Text('tariff-stub'))},
      ),
    ));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets('"Manzilsiz" makes the order metered and goes on to tariffs', (tester) async {
    await pump(tester);

    await tester.tap(find.text('Manzilsiz'));
    for (var i = 0; i < 6; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    expect(orders.isMetered, isTrue);
    expect(orders.pendingDropoff, isNull);
    expect(find.text('tariff-stub'), findsOneWidget);
  });

  testWidgets('not offered for cargo', (tester) async {
    orders.setServiceType('cargo');
    await pump(tester);
    expect(find.text('Manzilsiz'), findsNothing);
  });
}
