// Market sahifasi: do'konlar ro'yxati + BARCHA do'konlar bo'yicha qidiruv.
// Ilgari "Market" birinchi do'konni ochardi — qolganlari ko'rinmasdi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/superapp/screens/market_home_screen.dart';
import 'package:angren_taxi/features/superapp/screens/market_screen.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/market_product_card.dart';
import 'package:angren_taxi/features/superapp/widgets/market_store_card.dart';
import 'package:angren_taxi/l10n/gen/app_localizations.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _MockApiClient extends Mock implements ApiClient {}

class _RouteRecorder extends NavigatorObserver {
  final List<Route<dynamic>> pushed = [];
  final List<Route<dynamic>> replaced = [];

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) => pushed.add(route);

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (newRoute != null) replaced.add(newRoute);
  }
}

Response<dynamic> _ok(String path, Object? data) => Response(
      requestOptions: RequestOptions(path: path),
      statusCode: 200,
      data: {'success': true, 'data': data},
    );

Map<String, dynamic> _store(String id, String name) => {
      'id': id,
      'name': name,
      'address': 'Angren',
      'deliveryMode': 'platform',
      'workingHoursStart': '08:00',
      'workingHoursEnd': '22:00',
    };

Map<String, dynamic> _product(String id, String storeName) => {
      'id': id,
      'categoryId': null,
      'name': 'Sut $id',
      'price': 12000,
      'stock': 3,
      'status': 'active',
      'storeId': 'x',
      'store': {'id': 'x', 'name': storeName},
    };

void main() {
  late _MockApiClient api;
  late MarketProvider market;
  late SuperappProvider superapp;
  late _RouteRecorder recorder;

  setUpAll(() => registerFallbackValue(<String, dynamic>{}));

  setUp(() {
    api = _MockApiClient();
    recorder = _RouteRecorder();
    when(() => api.get(any(), params: any(named: 'params')))
        .thenAnswer((i) async => _ok(i.positionalArguments.first as String, <dynamic>[]));
    when(() => api.get(any())).thenAnswer((i) async => _ok(i.positionalArguments.first as String, <dynamic>[]));
    market = MarketProvider(apiClient: api, socketService: SocketService());
    superapp = SuperappProvider(apiClient: api);
  });

  void stores(List<Map<String, dynamic>> list) =>
      when(() => api.get(ApiEndpoints.marketStores)).thenAnswer((_) async => _ok(ApiEndpoints.marketStores, list));

  Future<void> pump(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: market),
          ChangeNotifierProvider.value(value: superapp),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          locale: const Locale('uz'),
          navigatorObservers: [recorder],
          home: MarketHomeScreen(apiClient: api),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
  }

  testWidgets("bir nechta do'kon — ro'yxat; bosilsa o'sha do'kon ochiladi", (tester) async {
    stores([_store('s1', 'Bozorcha'), _store('s2', 'Mini market')]);
    await pump(tester);

    expect(find.byType(MarketStoreCard), findsNWidgets(2));
    expect(find.text("Do'konlar"), findsOneWidget);

    await tester.tap(find.text('Mini market'));
    await tester.pump();
    final page = (recorder.pushed.last as MaterialPageRoute<dynamic>).builder(
      tester.element(find.byType(MarketHomeScreen)),
    );
    expect(page, isA<MarketScreen>());
    expect((page as MarketScreen).storeId, 's2');
  });

  testWidgets("B reja: bitta do'kon — ro'yxatsiz, to'g'ridan-to'g'ri ochiladi", (tester) async {
    stores([_store('only', 'Bozorcha')]);
    await pump(tester);

    expect(recorder.replaced, hasLength(1));
    final page = (recorder.replaced.single as MaterialPageRoute<dynamic>)
        .builder(tester.element(find.byType(MaterialApp)));
    expect((page as MarketScreen).storeId, 'only');
  });

  testWidgets("qidiruv BARCHA do'konlardan — natijada do'kon nomi", (tester) async {
    stores([_store('s1', 'Bozorcha'), _store('s2', 'Mini market')]);
    when(() => api.get(ApiEndpoints.marketProductSearch, params: {'q': 'sut', 'page': 1, 'limit': 20}))
        .thenAnswer((_) async => _ok(ApiEndpoints.marketProductSearch, {
              'items': [_product('1', 'Bozorcha'), _product('2', 'Mini market')],
              'hasMore': false,
            }));
    await pump(tester);

    await tester.enterText(find.byType(TextField), 'sut');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();

    expect(find.byType(MarketProductCard), findsNWidgets(2));
    expect(find.text('Mini market'), findsOneWidget);
    expect(find.byType(MarketStoreCard), findsNothing);
  });

  testWidgets("1 harf — qidirilmaydi; tozalansa do'konlar qaytadi", (tester) async {
    stores([_store('s1', 'Bozorcha'), _store('s2', 'Mini market')]);
    await pump(tester);

    await tester.enterText(find.byType(TextField), 's');
    await tester.pump(const Duration(milliseconds: 400));
    verifyNever(() => api.get(ApiEndpoints.marketProductSearch, params: any(named: 'params')));
    expect(find.byType(MarketStoreCard), findsNWidgets(2));
  });

  testWidgets("topilmasa — bo'sh holat", (tester) async {
    stores([_store('s1', 'Bozorcha'), _store('s2', 'Mini market')]);
    when(() => api.get(ApiEndpoints.marketProductSearch, params: any(named: 'params')))
        .thenAnswer((_) async => _ok(ApiEndpoints.marketProductSearch, {'items': <dynamic>[], 'hasMore': false}));
    await pump(tester);

    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();

    expect(find.text('Hech narsa topilmadi'), findsOneWidget);
  });

  testWidgets("do'konlar yuklanmasa — xato va qayta urinish", (tester) async {
    when(() => api.get(ApiEndpoints.marketStores)).thenThrow(
      DioException(requestOptions: RequestOptions(path: ApiEndpoints.marketStores)),
    );
    await pump(tester);

    expect(find.byType(MarketStoreCard), findsNothing);
    expect(recorder.replaced, isEmpty);
    expect(find.byIcon(Icons.refresh_rounded).evaluate().isNotEmpty || find.textContaining('urin').evaluate().isNotEmpty,
        isTrue);
  });
}
