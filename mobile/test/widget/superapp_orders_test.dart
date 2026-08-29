// XARAKTERISTIK TEST — `superapp/screens/orders_screen.dart`.
//
// Bu ekranda ham bitta test yo'q edi. U bir vaqtning o'zida TO'RTTA
// vertikalni (taksi, yuk, ovqat, market) ko'rsatadi, ya'ni regressiya
// yashirinishi uchun eng qulay joy. Pastdagi testlar avval hozirgi
// xulq-atvorni qulflaydi, keyin ekran bitta kuzatuvchi komponent atrofida
// qayta quriladi.
//
// Testlar ATAYLAB ma'lumot darajasida yozilgan (manzil, narx, holat nomi,
// dona soni) — ya'ni ular kartaning ichki tuzilishi o'zgarsa ham
// yashil qoladi, lekin yo'lovchi ko'radigan FAKT yo'qolsa qizaradi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/screens/orders_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _envelope(String path, Object? data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

const _activeRideJson = {
  'id': 'order-active-1',
  'passengerId': 'passenger-1',
  'pickup': {'address': 'Markaz', 'lat': 41.0167, 'lng': 70.1436},
  'dropoff': {'address': 'Uy', 'lat': 41.02, 'lng': 70.15},
  'status': 'accepted',
  'estimatedPrice': 21000.0,
  'createdAt': '2026-07-12T10:00:00.000Z',
  'serviceType': 'taxi',
  'driver': {
    'id': 'driver-1',
    'name': 'Bobur A.',
    'phone': '+998901112233',
    'carNumber': '01 A 777 BB',
    'carModel': 'Cobalt',
  },
};

const _finishedRideJson = {
  'id': 'order-done-1',
  'passengerId': 'passenger-1',
  'pickup': {'address': 'Bozor', 'lat': 41.01, 'lng': 70.14},
  'dropoff': {'address': 'Vokzal', 'lat': 41.025, 'lng': 70.155},
  'status': 'completed',
  'estimatedPrice': 19000.0,
  'finalPrice': 19000.0,
  'createdAt': '2026-07-10T10:00:00.000Z',
  'serviceType': 'taxi',
};

const _cargoRideJson = {
  'id': 'order-cargo-1',
  'passengerId': 'passenger-1',
  'pickup': {'address': 'Ombor', 'lat': 41.01, 'lng': 70.14},
  'dropoff': {'address': 'Zavod', 'lat': 41.03, 'lng': 70.16},
  'status': 'completed',
  'estimatedPrice': 46000.0,
  'finalPrice': 46000.0,
  'createdAt': '2026-07-09T10:00:00.000Z',
  'serviceType': 'cargo',
};

const _foodOrderJson = {
  'id': 'food-order-abc123',
  'restaurantId': 'rest-1',
  'status': 'preparing',
  'items': [
    {'dishId': 'd1', 'name': 'Somsa', 'qty': 2, 'price': 12000},
  ],
  'deliveryAddress': 'Navoiy 12',
  'totalPrice': 31000.0,
  'createdAt': '2026-07-11T10:00:00.000Z',
};

const _marketOrderJson = {
  'id': 'market-order-xyz789',
  'storeId': 'store-1',
  'status': 'delivered',
  'items': [
    {'productId': 'p1', 'name': 'Non', 'qty': 3, 'price': 5000},
  ],
  'deliveryAddress': 'Navoiy 12',
  'totalPrice': 22000.0,
  'createdAt': '2026-07-08T10:00:00.000Z',
};

const _deliveredFoodOrderJson = {
  'id': 'food-order-done99',
  'restaurantId': 'rest-1',
  'status': 'delivered',
  'items': [
    {'dishId': 'd9', 'name': 'Mastava', 'qty': 5, 'price': 18000},
  ],
  'deliveryAddress': 'Navoiy 12',
  'totalPrice': 88000.0,
  'createdAt': '2026-07-06T10:00:00.000Z',
};

const _cancelledRideJson = {
  'id': 'order-cancelled-1',
  'passengerId': 'passenger-1',
  'pickup': {'address': 'Maktab', 'lat': 41.01, 'lng': 70.14},
  'dropoff': {'address': 'Park', 'lat': 41.03, 'lng': 70.16},
  'status': 'cancelled',
  'estimatedPrice': 15000.0,
  'createdAt': '2026-07-07T10:00:00.000Z',
  'serviceType': 'taxi',
};

const _activeMarketOrderJson = {
  'id': 'market-order-live1',
  'storeId': 'store-1',
  'status': 'packing',
  'items': [
    {'productId': 'p1', 'name': 'Non', 'qty': 4, 'price': 5000},
  ],
  'deliveryAddress': 'Navoiy 12',
  'totalPrice': 27000.0,
  'createdAt': '2026-07-13T10:00:00.000Z',
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Ekran sanani `Formatters.formatDateTime` orqali chizadi — 'uz' lokal
  // ma'lumoti oldindan yuklanishi kerak.
  setUpAll(() async {
    await initializeDateFormatting('uz', null);
  });

  late MockApiClient apiClient;
  late OrderProvider taxi;
  late FoodProvider food;
  late MarketProvider market;

  void stubHistories({
    List<Map<String, dynamic>> taxiOrders = const [],
    List<Map<String, dynamic>> foodOrders = const [],
    List<Map<String, dynamic>> marketOrders = const [],
  }) {
    when(() => apiClient.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _envelope(ApiEndpoints.orderHistory, {
        'orders': taxiOrders,
        'total': taxiOrders.length,
        'page': 1,
        'limit': 20,
      }),
    );
    when(() => apiClient.get(ApiEndpoints.foodOrders))
        .thenAnswer((_) async => _envelope(ApiEndpoints.foodOrders, foodOrders));
    when(() => apiClient.get(ApiEndpoints.marketOrders)).thenAnswer(
        (_) async => _envelope(ApiEndpoints.marketOrders, marketOrders));
  }

  setUp(() {
    apiClient = MockApiClient();
    final socket = SocketService();
    taxi = OrderProvider(apiClient: apiClient, socketService: socket);
    food = FoodProvider(apiClient: apiClient, socketService: socket);
    market = MarketProvider(apiClient: apiClient, socketService: socket);
    stubHistories();
  });

  Future<void> pumpOrders(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<OrderProvider>.value(value: taxi),
          ChangeNotifierProvider<FoodProvider>.value(value: food),
          ChangeNotifierProvider<MarketProvider>.value(value: market),
        ],
        child: const MaterialApp(home: OrdersScreen(embedded: true)),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('ochilganda uchala vertikal tarixi yuklanadi', (tester) async {
    await pumpOrders(tester);

    verify(() => apiClient.get(ApiEndpoints.orderHistory)).called(1);
    verify(() => apiClient.get(ApiEndpoints.foodOrders)).called(1);
    verify(() => apiClient.get(ApiEndpoints.marketOrders)).called(1);
    expect(find.text('Buyurtmalar'), findsOneWidget);
  });

  testWidgets('faol safar yo\'nalish, haydovchi, narx va holat bilan chiziladi',
      (tester) async {
    stubHistories(taxiOrders: const [_activeRideJson]);
    // `loadOrderHistory` faol buyurtmani O'RNATMAYDI — hozirgi ekran uni
    // faqat boshqa oqim `checkActiveOrder()` ni chaqirgan bo'lsa ko'radi.
    await taxi.checkActiveOrder();

    await pumpOrders(tester);

    expect(find.textContaining('Markaz'), findsWidgets);
    expect(find.textContaining('Uy'), findsWidgets);
    expect(find.textContaining('Bobur A.'), findsOneWidget);
    expect(find.text(Formatters.formatSom(21000)), findsWidgets);
    expect(find.text('Haydovchi tayinlandi'), findsWidgets);
  });

  testWidgets('tugagan safar tarixda narx va holat bilan turadi',
      (tester) async {
    stubHistories(taxiOrders: const [_finishedRideJson]);

    await pumpOrders(tester);

    expect(find.textContaining('Bozor'), findsWidgets);
    expect(find.text(Formatters.formatSom(19000)), findsWidgets);
    expect(find.text('Yakunlandi'), findsWidgets);
  });

  testWidgets('tugagan safar bosilganda tafsilot ekrani ochiladi',
      (tester) async {
    stubHistories(taxiOrders: const [_finishedRideJson]);

    await pumpOrders(tester);

    await tester.tap(find.textContaining('Bozor').first);
    await tester.pumpAndSettle();

    // Tafsilot ekranining o'ziga xos elementi — chek tugmasi.
    expect(find.text("Chekni ko'rish"), findsOneWidget);
    expect(find.textContaining('Bozor'), findsWidgets);
  });

  testWidgets('ovqat buyurtmasi dona soni, narx va holat bilan chiziladi',
      (tester) async {
    stubHistories(foodOrders: const [_foodOrderJson]);

    await pumpOrders(tester);

    expect(find.text('2 ta taom'), findsOneWidget);
    expect(find.text(Formatters.formatSom(31000)), findsOneWidget);
    expect(find.text('Tayyorlanmoqda'), findsWidgets);
  });

  testWidgets('market buyurtmasi dona soni, narx va holat bilan chiziladi',
      (tester) async {
    stubHistories(marketOrders: const [_marketOrderJson]);

    await pumpOrders(tester);

    expect(find.text('3 ta mahsulot'), findsOneWidget);
    expect(find.text(Formatters.formatSom(22000)), findsOneWidget);
    expect(find.text('Yetkazildi'), findsWidgets);
  });

  testWidgets('hech qanday buyurtma yo\'q — bo\'sh holat ko\'rsatiladi',
      (tester) async {
    await pumpOrders(tester);

    expect(find.byIcon(Icons.local_taxi_rounded), findsWidgets);
    expect(find.textContaining("yo'q"), findsWidgets);
  });

  // ⚠️ HAQIQIY NUQSON (avval QIZIL, tuzatishdan keyin yashil).
  //
  // Ekran ochilganda faqat `loadOrderHistory()` chaqiriladi, u esa
  // `OrderProvider._activeOrder` ni O'RNATMAYDI (uni faqat
  // `checkActiveOrder()` to'ldiradi). Ayni paytda tarix ro'yxati
  // `!o.isActive` bo'yicha filtrlanadi. Natijada ilova qayta ochilib,
  // yo'lovchi to'g'ridan-to'g'ri "Buyurtmalar" ga kirsa, JONLI safar
  // ekranda umuman qolmaydi — na faol karta, na tarix qatori.
  testWidgets('jonli safar checkActiveOrder chaqirilmagan holda ham ko\'rinadi',
      (tester) async {
    stubHistories(taxiOrders: const [_activeRideJson]);
    // `checkActiveOrder()` ATAYLAB chaqirilmaydi.

    await pumpOrders(tester);

    expect(
      find.textContaining('Markaz'),
      findsWidgets,
      reason: 'Jonli safar serverdan kelgan tarixda bor — u ekrandan '
          'yo\'qolib qolmasligi kerak',
    );
    expect(find.text('Haydovchi tayinlandi'), findsWidgets);
  });

  testWidgets('yuk safari ham shu ro\'yxatda ko\'rinadi', (tester) async {
    stubHistories(taxiOrders: const [_cargoRideJson]);

    await pumpOrders(tester);

    expect(find.textContaining('Ombor'), findsWidgets);
    expect(find.text(Formatters.formatSom(46000)), findsWidgets);
  });

  // ------------------------------------------------------------------
  // QAYTA QURISHDAN KEYINGI YANGI XULQ-ATVOR.
  // Yuqoridagi testlar yo'qolmasligi kerak bo'lgan FAKTlarni qulflaydi,
  // pastdagilar esa yangi tuzilmani (bitta kuzatuvchi, bosqich chiziqlari,
  // ishlaydigan filtr) qulflaydi.
  // ------------------------------------------------------------------

  testWidgets('jonli buyurtma bosqichlari CHIZIQ va NOM bilan ko\'rsatiladi',
      (tester) async {
    stubHistories(foodOrders: const [_foodOrderJson]); // 'preparing'

    await pumpOrders(tester);

    // Bosqich nomi — foiz emas.
    expect(find.text('Tayyorlanmoqda'), findsWidgets);
    // O'rin ko'rsatkichi: 4 bosqichdan 2-si.
    expect(find.text('2/4'), findsOneWidget);
    expect(find.textContaining('%'), findsNothing);
  });

  testWidgets('market va ovqat bosqich NOMLARI har xil, karta bir xil',
      (tester) async {
    stubHistories(marketOrders: const [_activeMarketOrderJson]); // 'packing'

    await pumpOrders(tester);

    // Marketda "Yig'ilmoqda", ovqatda esa "Tayyorlanmoqda" — farq faqat
    // bosqich nomida, komponentda emas.
    expect(find.text("Yig'ilmoqda"), findsWidgets);
    expect(find.text('2/4'), findsOneWidget);
    expect(find.text('4 ta mahsulot'), findsOneWidget);
  });

  testWidgets('bekor qilingan buyurtmada bosqich chizig\'i chizilmaydi',
      (tester) async {
    stubHistories(taxiOrders: const [_cancelledRideJson]);

    await pumpOrders(tester);

    expect(find.text('Bekor qilingan'), findsNothing); // holat nomi modeldan
    expect(find.text('Bekor qilindi'), findsWidgets);
    // Yarim to'lgan chiziq bekor qilingan buyurtmada yolg'on gapiradi.
    expect(find.textContaining('/4'), findsNothing);
  });

  testWidgets('yuk safari o\'z ikonkasi va "Yuk" yorlig\'i bilan chiziladi',
      (tester) async {
    stubHistories(taxiOrders: const [_cargoRideJson]);

    await pumpOrders(tester);

    expect(find.byIcon(Icons.local_shipping_rounded), findsOneWidget);
    expect(find.textContaining('Yuk ·'), findsOneWidget);
  });

  testWidgets('Faol/Tarix chiplari haqiqiy filtr (ilgari soxta edi)',
      (tester) async {
    stubHistories(
      taxiOrders: const [_activeRideJson, _finishedRideJson],
      marketOrders: const [_marketOrderJson],
    );

    await pumpOrders(tester);

    // Faol buyurtma bor — sukut bo'yicha "Faol" ochiladi.
    expect(find.textContaining('Markaz'), findsWidgets);
    expect(find.textContaining('Bozor'), findsNothing);

    await tester.tap(find.textContaining('Tarix'));
    await tester.pumpAndSettle();

    // Tarixda ikkala vertikal ham BIR XIL kartada.
    expect(find.textContaining('Bozor'), findsWidgets);
    expect(find.text('3 ta mahsulot'), findsOneWidget);
    expect(find.textContaining('Markaz'), findsNothing);
  });

  testWidgets(
      'faol buyurtma bo\'lmasa, tarix darhol ochiladi (boshi berk ko\'cha yo\'q)',
      (tester) async {
    stubHistories(taxiOrders: const [_finishedRideJson]);

    await pumpOrders(tester);

    expect(find.textContaining('Bozor'), findsWidgets);
    expect(find.text("Faol buyurtma yo'q"), findsNothing);
  });

  // ------------------------------------------------------------------
  // ⚠️ TUZILMAVIY TEKSHIRUVLAR.
  //
  // Yuqoridagi testlar har bir vertikal ALOHIDA ko'rsatilganda to'g'ri
  // chizilishini tekshiradi — lekin ular to'rtta vertikal uchun to'rtta
  // TURLI karta yozilgan bo'lsa ham yashil qolaveradi. Aynan shu — super-app
  // arxitekturasidagi eng keng tarqalgan xato. Pastdagi ikkita test
  // to'rttalasini BIR VAQTDA ro'yxatga qo'yadi va tuzilmani qulflaydi.
  // ------------------------------------------------------------------

  /// Ekranni kengroq yuzada ochadi — to'rtta karta ham qurilishi (va
  /// o'lchanishi) uchun. Aks holda ListView pastdagilarini yaratmasligi
  /// mumkin va test tuzilma emas, ekran balandligini tekshirib qolardi.
  Future<void> pumpTallOrders(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1200, 2400);
    tester.view.devicePixelRatio = 3.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await pumpOrders(tester);
  }

  testWidgets(
      "to'rtala vertikal BITTA karta komponenti bilan chiziladi (bitta kuzatuvchi)",
      (tester) async {
    stubHistories(
      taxiOrders: const [_finishedRideJson, _cargoRideJson],
      foodOrders: const [_deliveredFoodOrderJson],
      marketOrders: const [_marketOrderJson],
    );

    await pumpTallOrders(tester);

    // To'rtta buyurtma — to'rtta karta. Beshinchi konteyner paydo bo'lsa
    // (masalan "faqat ovqat uchun" alohida karta qaytarilsa) shu yerda
    // qizaradi.
    expect(
      find.byType(AgSurfaceCard),
      findsNWidgets(4),
      reason: 'Har vertikal o\'z kartasini olsa, super-app tili ikkiga '
          "bo'linadi va beshinchi vertikal beshinchi kartani talab qiladi",
    );

    // Har bir vertikalning FAKTi ro'yxatda.
    expect(find.textContaining('Bozor'), findsWidgets); // taksi
    expect(find.textContaining('Ombor'), findsWidgets); // yuk
    expect(find.text('5 ta taom'), findsOneWidget); // ovqat
    expect(find.text('3 ta mahsulot'), findsOneWidget); // market

    // Farq FAQAT ikonkada — to'rttasi ham bittadan.
    expect(find.byIcon(Icons.local_taxi_rounded), findsOneWidget);
    expect(find.byIcon(Icons.local_shipping_rounded), findsOneWidget);
    expect(find.byIcon(Icons.restaurant_rounded), findsOneWidget);
    expect(find.byIcon(Icons.storefront_rounded), findsOneWidget);
  });

  testWidgets(
      "ro'yxat vertikallar bo'yicha emas, SANA bo'yicha (yangisi tepada)",
      (tester) async {
    stubHistories(
      taxiOrders: const [_finishedRideJson, _cargoRideJson], // 07-10, 07-09
      foodOrders: const [_deliveredFoodOrderJson], // 07-06
      marketOrders: const [_marketOrderJson], // 07-08
    );

    await pumpTallOrders(tester);

    double y(Finder f) => tester.getTopLeft(f.first).dy;

    final taxiY = y(find.textContaining('Bozor'));
    final cargoY = y(find.textContaining('Ombor'));
    final marketY = y(find.text('3 ta mahsulot'));
    final foodY = y(find.text('5 ta taom'));

    // 07-10 > 07-09 > 07-08 > 07-06 — vertikal bo'limlari yo'q, bitta oqim.
    expect(taxiY, lessThan(cargoY));
    expect(cargoY, lessThan(marketY));
    expect(
      marketY,
      lessThan(foodY),
      reason: "Vertikal bo'yicha guruhlangan ro'yxat qaytsa, kechagi taksi "
          "o'tgan oygi market buyurtmasidan pastda qolardi",
    );
  });
}
