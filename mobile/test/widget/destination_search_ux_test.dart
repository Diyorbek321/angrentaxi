// Manzil qidiruvi: topilmasa boshi berk ko'cha emas — xaritadan tanlash
// taklif qilinadi; bo'sh qidiruvda oxirgi manzillar ko'rinadi.
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

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _ok(String path, Object data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

void main() {
  late _MockApiClient api;

  setUp(() {
    api = _MockApiClient();
    when(() => api.get(ApiEndpoints.favoriteAddresses))
        .thenAnswer((_) async => _ok(ApiEndpoints.favoriteAddresses, <dynamic>[]));
    when(() => api.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _ok(ApiEndpoints.orderHistory, {
        'orders': [
          {
            'id': 'o-1',
            'passengerId': 'p-1',
            'pickup': {'address': 'Uy', 'lat': 41.0, 'lng': 70.1},
            'dropoff': {'address': 'Angren dehqon bozori', 'lat': 41.01, 'lng': 70.14},
            'status': 'completed',
            'estimatedPrice': 15000,
            'createdAt': '2026-10-09T10:00:00.000Z',
          },
        ],
      }),
    );
  });

  Future<void> pumpScreen(WidgetTester tester) async {
    final orders = OrderProvider(apiClient: api, socketService: SocketService())
      ..setPendingPickup(const OrderLocation(address: 'Uy', lat: 41.0, lng: 70.1));
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<OrderProvider>.value(value: orders),
          ChangeNotifierProvider<FavoritesProvider>(
            create: (_) => FavoritesProvider(apiClient: api),
          ),
        ],
        child: const MaterialApp(home: DestinationScreen()),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  testWidgets('bo\'sh qidiruvda oxirgi manzillar ko\'rinadi', (tester) async {
    await pumpScreen(tester);

    expect(find.text('Oxirgi manzillar'), findsOneWidget);
    expect(find.text('Angren dehqon bozori'), findsOneWidget);
  });

  testWidgets('topilmasa — "Qayta urinish" emas, "Xaritadan tanlash"', (tester) async {
    await pumpScreen(tester);

    await tester.enterText(find.byType(TextField), 'navro\'z to\'yxonasi');
    // Kechiktirish (400 ms) + geokoder javobi (testda plagin yo'q → xato).
    await tester.pump(const Duration(milliseconds: 450));
    await tester.pump();

    expect(find.text("Manzilni topib bo'lmadi"), findsOneWidget);
    expect(find.text('Qayta urinish'), findsNothing);
    // Biri harakatlar qatorida, biri bo'sh holatning o'zida.
    expect(find.text('Xaritadan tanlash'), findsNWidgets(2));
  });

  testWidgets('har harfda emas — yozish to\'xtagach so\'raladi', (tester) async {
    await pumpScreen(tester);

    await tester.enterText(find.byType(TextField), 'boz');
    await tester.pump(const Duration(milliseconds: 200));
    await tester.enterText(find.byType(TextField), 'bozo');
    await tester.pump(const Duration(milliseconds: 200));
    // 400 ms hali o'tmagan — natija ham, xato ham yo'q.
    expect(find.text("Manzilni topib bo'lmadi"), findsNothing);
    await tester.pump(const Duration(milliseconds: 250));
    await tester.pump();
    expect(find.text("Manzilni topib bo'lmadi"), findsOneWidget);
  });
}
