// Restoran menyusi dangasa (sliver) ro'yxatda: faqat ko'ringan taomlar
// quriladi, aylantirganda qolganlari chiqadi; bo'sh menyu holati saqlanadi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/screens/restaurant_detail_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _json(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Map<String, dynamic> _detail(int dishCount) => {
      'restaurant': {'id': 'rest-1', 'name': 'Osh Markazi', 'status': 'open'},
      'categories': <dynamic>[],
      'dishes': [
        for (var i = 0; i < dishCount; i++)
          {'id': 'd$i', 'name': 'Taom $i', 'price': 20000 + i},
      ],
    };

void main() {
  Future<void> pumpDetail(WidgetTester tester, int dishCount) async {
    final api = _MockApiClient();
    when(() => api.get(ApiEndpoints.foodRestaurant('rest-1'))).thenAnswer(
      (_) async => _json(ApiEndpoints.foodRestaurant('rest-1'), _detail(dishCount)),
    );
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<FoodProvider>(
            create: (_) => FoodProvider(apiClient: api, socketService: SocketService()),
          ),
          ChangeNotifierProvider<SuperappProvider>(
            create: (_) => SuperappProvider(apiClient: api),
          ),
        ],
        child: const MaterialApp(home: RestaurantDetailScreen(restaurantId: 'rest-1')),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  testWidgets('uzun menyu dangasa quriladi va aylantirganda oxirgisi chiqadi', (tester) async {
    await pumpDetail(tester, 60);

    expect(find.text('Osh Markazi'), findsOneWidget);
    expect(find.text('Taom 0'), findsOneWidget);
    // Ekrandan ancha pastdagi taom hali qurilmagan.
    expect(find.text('Taom 59'), findsNothing);

    await tester.scrollUntilVisible(find.text('Taom 59'), 400);
    expect(find.text('Taom 59'), findsOneWidget);
  });

  testWidgets('bo\'sh menyu — bo\'sh holat ko\'rinadi', (tester) async {
    await pumpDetail(tester, 0);

    expect(find.text('Osh Markazi'), findsOneWidget);
    expect(find.text('Taom 0'), findsNothing);
    expect(find.byIcon(Icons.restaurant_menu_rounded), findsOneWidget);
  });
}
