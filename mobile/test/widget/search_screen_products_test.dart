// Umumiy qidiruv: mahsulotlar BARCHA do'konlardan (server), server
// ishlamasa — yuklangan do'kon ichidan (B reja, avvalgi xulq).
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/screens/search_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _ok(String path, Object? data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

Map<String, dynamic> _product(String id, String name, {String? storeName}) => {
      'id': id,
      'categoryId': null,
      'name': name,
      'price': 9000,
      'stock': 2,
      'status': 'active',
      'unit': 'dona',
      if (storeName != null) 'store': {'id': 'x', 'name': storeName},
    };

void main() {
  late _MockApiClient api;
  late FoodProvider food;
  late MarketProvider market;

  setUpAll(() => registerFallbackValue(<String, dynamic>{}));

  setUp(() {
    api = _MockApiClient();
    when(() => api.get(any())).thenAnswer((i) async => _ok(i.positionalArguments.first as String, <dynamic>[]));
    // Yuklangan (birinchi) do'kon katalogi — lokal zaxira.
    when(() => api.get(ApiEndpoints.marketStores)).thenAnswer(
      (_) async => _ok(ApiEndpoints.marketStores, [
        {'id': 's1', 'name': 'Bozorcha'},
      ]),
    );
    when(() => api.get(ApiEndpoints.marketStore('s1'))).thenAnswer(
      (_) async => _ok(ApiEndpoints.marketStore('s1'), {
        'store': {'id': 's1', 'name': 'Bozorcha'},
        'categories': <dynamic>[],
        'products': [_product('local', 'Sut mahalliy')],
      }),
    );
    food = FoodProvider(apiClient: api, socketService: SocketService());
    market = MarketProvider(apiClient: api, socketService: SocketService());
  });

  Future<void> pumpAndType(WidgetTester tester, String text) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: food),
          ChangeNotifierProvider.value(value: market),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('uz'),
          home: SearchScreen(apiClient: api),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    await tester.enterText(find.byType(TextField), text);
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
  }

  testWidgets("server natijasi — boshqa do'kon mahsuloti ham, do'kon nomi bilan", (tester) async {
    when(() => api.get(ApiEndpoints.marketProductSearch, params: any(named: 'params'))).thenAnswer(
      (_) async => _ok(ApiEndpoints.marketProductSearch, {
        'items': [_product('remote', 'Sut 1 L', storeName: 'Mini market')],
        'hasMore': false,
      }),
    );

    await pumpAndType(tester, 'sut');

    expect(find.text('Sut 1 L'), findsOneWidget);
    expect(find.text('Mini market · dona'), findsOneWidget);
    expect(find.text('Sut mahalliy'), findsNothing);
  });

  testWidgets("B reja: server xato bersa — yuklangan do'kon ichidan", (tester) async {
    when(() => api.get(ApiEndpoints.marketProductSearch, params: any(named: 'params'))).thenThrow(
      DioException(requestOptions: RequestOptions(path: ApiEndpoints.marketProductSearch)),
    );

    await pumpAndType(tester, 'sut');

    expect(find.text('Sut mahalliy'), findsOneWidget);
  });
}
