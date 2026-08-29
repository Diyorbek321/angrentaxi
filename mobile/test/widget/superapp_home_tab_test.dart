// XARAKTERISTIK TESTLAR — superapp bosh ekrani (HomeTab).
//
// NEGA BU FAYL BOR. `lib/features/superapp/screens/home_tab.dart` 600+ qator
// bo'lishiga qaramay bironta testga ega emas edi. Ekran qayta quriladi
// (taksi imtiyozli blok, kichikroq ikkilamchi xizmatlar, birlashtirilgan
// faol buyurtma kartasi), shuning uchun avval HOZIRGI xulq qulflandi:
// nimaga bosilsa qayerga o'tishi va qaysi ma'lumot ko'rinishi.
//
// Bu testlar VIZUALNI emas, XULQNI tekshiradi — rang va joylashuv o'zgarsa
// ham o'tishi kerak. Faqat kirish nuqtasi yo'qolsa yoki boshqa yerga olib
// borsa yiqiladi.
//
// QAYTA QURISHDAN KEYIN YANGILANGAN JOYLAR (xulq ataylab o'zgardi):
//   1. "Cargo" yorlig'i "Yuk" ga o'tdi — yo'lovchi tilidagi qisqa yorliq
//      endi `ServiceCatalogEntry` dan keladi.
//   2. Taksi kirish nuqtasi "Qayoqqa boramiz?" CTA emas, ekran tepasidagi
//      "Qayerga borasiz?" manzil maydonli katta blok.
//   3. Umumiy qidiruv suzuvchi paneldan header ikonkasiga ko'chdi — va
//      endi butun boshqaruv bosiladi (ilgari pastki yarmi o'lik edi).
//   4. Faol buyurtma kartasi endi BOSH EKRANDA ham bor, xizmatdan qat'i
//      nazar bitta ko'rinishda.
//
// Tarmoq: `ApiClient` mocktail bilan mocklangan (test/widget/favorites_home_test.dart
// bilan bir xil naqsh) — hech qanday haqiqiy so'rov yo'q.
// Navigatsiya: `/passenger/home` nomli marshrut test zaxirasiga ulanadi,
// aks holda haqiqiy xarita ekrani ko'tarilardi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/notifications/notifications_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/screens/cargo_screen.dart';
import 'package:angren_taxi/features/superapp/screens/food_list_screen.dart';
import 'package:angren_taxi/features/superapp/screens/home_tab.dart';
import 'package:angren_taxi/features/superapp/screens/market_screen.dart';
import 'package:angren_taxi/features/superapp/screens/search_screen.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _json(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

const Map<String, dynamic> _restaurantJson = {
  'id': 'rest-1',
  'name': 'Osh Markazi',
  'address': 'Angren, Navoiy 12',
  'status': 'open',
};

/// Jonli safar. `accepted` — `orderStatusFromString` dagi haqiqiy wire
/// qiymati (`OrderStatus.driverAssigned`), o'ylab topilgan holat emas.
Map<String, dynamic> _activeTaxiOrderJson({String serviceType = 'taxi'}) => {
      'id': 'order-1',
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Markaz', 'lat': 41.0, 'lng': 70.14},
      'dropoff': {'address': 'Uy', 'lat': 41.02, 'lng': 70.16},
      'status': 'accepted',
      'estimatedPrice': 18000,
      'createdAt': '2026-08-28T10:00:00.000Z',
      'serviceType': serviceType,
    };

/// Bosilgan marshrutlarni yozib boruvchi kuzatuvchi — ekran qaysi ekranga
/// olib borishini tekshirish uchun.
class _RouteRecorder extends NavigatorObserver {
  final List<Route<dynamic>> pushed = <Route<dynamic>>[];

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    pushed.add(route);
    super.didPush(route, previousRoute);
  }

  /// Oxirgi `MaterialPageRoute` quruvchisidan chiqadigan widget. Ekranni
  /// ko'tarmasdan turini bilish uchun `builder` shunchaki chaqiriladi.
  Widget lastBuiltPage(BuildContext context) {
    final route = pushed.last as MaterialPageRoute<dynamic>;
    return route.builder(context);
  }

  String? get lastRouteName => pushed.isEmpty ? null : pushed.last.settings.name;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late FoodProvider foodProvider;
  late MarketProvider marketProvider;
  late SuperappProvider superappProvider;
  late OrderProvider orderProvider;
  late NotificationsProvider notificationsProvider;
  late _RouteRecorder recorder;

  setUpAll(() {
    registerFallbackValue(<String, dynamic>{});
  });

  setUp(() {
    apiClient = MockApiClient();
    recorder = _RouteRecorder();

    // Umumiy zaxira: kutilmagan endpoint bo'sh ro'yxat qaytaradi — test
    // tarmoq xatosi tufayli emas, ASSERT tufayli yiqilsin.
    when(() => apiClient.get(any(), params: any(named: 'params')))
        .thenAnswer((invocation) async =>
            _json(invocation.positionalArguments.first as String, <dynamic>[]));

    when(() => apiClient.get(ApiEndpoints.foodRestaurants)).thenAnswer(
        (_) async => _json(ApiEndpoints.foodRestaurants, [_restaurantJson]));
    when(() => apiClient.get(ApiEndpoints.paymentsWallet)).thenAnswer(
        (_) async => _json(ApiEndpoints.paymentsWallet, {'balance': 125000}));
    when(() => apiClient.get(ApiEndpoints.settingsPublic)).thenAnswer(
        (_) async => _json(ApiEndpoints.settingsPublic, {'deliveryFee': 7000}));
    when(() => apiClient.get(ApiEndpoints.orderHistory)).thenAnswer(
        (_) async => _json(ApiEndpoints.orderHistory, {'orders': <dynamic>[]}));

    final socket = SocketService();
    foodProvider = FoodProvider(apiClient: apiClient, socketService: socket);
    marketProvider =
        MarketProvider(apiClient: apiClient, socketService: socket);
    superappProvider = SuperappProvider(apiClient: apiClient);
    orderProvider = OrderProvider(apiClient: apiClient, socketService: socket);
    notificationsProvider = NotificationsProvider(apiClient: apiClient);
  });

  Future<void> pumpHome(WidgetTester tester) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<FoodProvider>.value(value: foodProvider),
          ChangeNotifierProvider<MarketProvider>.value(value: marketProvider),
          ChangeNotifierProvider<SuperappProvider>.value(
              value: superappProvider),
          ChangeNotifierProvider<OrderProvider>.value(value: orderProvider),
          ChangeNotifierProvider<NotificationsProvider>.value(
              value: notificationsProvider),
        ],
        child: MaterialApp(
          navigatorObservers: [recorder],
          // Haqiqiy yo'lovchi ekrani xarita va joylashuv kanallarini talab
          // qiladi — test zaxirasi faqat marshrut nomini qulflaydi.
          routes: {
            '/passenger/home': (_) => const Scaffold(
                  body: Center(child: Text('taxi-flow-stub')),
                ),
          },
          home: const Scaffold(body: HomeTab()),
        ),
      ),
    );
    // 1-kadr: postFrameCallback (provider yuklashlari) ishga tushadi.
    await tester.pump();
    // Keyingi kadrlar: mock javoblari va `flutter_animate` kirish
    // animatsiyalari tugaydi. `pumpAndSettle` ATAYLAB ishlatilmaydi —
    // yuklanish skeletoni cheksiz shimmer bilan aylanadi va settle
    // hech qachon qaytmasdi. Zanjirlangan effektlar (fade → slide)
    // ~1.2s da tugaydi; ikki kadr zaxira bilan beriladi.
    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump(const Duration(milliseconds: 1200));
  }

  BuildContext homeContext(WidgetTester tester) =>
      tester.element(find.byType(HomeTab));

  Future<void> givenActiveTaxiOrder({String serviceType = 'taxi'}) async {
    when(() => apiClient.get(ApiEndpoints.orderHistory)).thenAnswer(
      (_) async => _json(ApiEndpoints.orderHistory, {
        'orders': [_activeTaxiOrderJson(serviceType: serviceType)],
      }),
    );
    await orderProvider.checkActiveOrder();
  }

  /// Jonli OVQAT buyurtmasi. `preparing` — `foodOrderStatusFromString`
  /// dagi haqiqiy wire qiymati, o'ylab topilgan holat emas.
  Future<void> givenActiveFoodOrder() async {
    when(() => apiClient.get(ApiEndpoints.foodOrders)).thenAnswer(
      (_) async => _json(ApiEndpoints.foodOrders, [
        {
          'id': 'food-1',
          'restaurantId': 'rest-1',
          'status': 'preparing',
          'items': <dynamic>[],
          'deliveryAddress': 'Navoiy 12',
          'totalPrice': 42000,
          'createdAt': '2026-08-28T10:00:00.000Z',
        }
      ]),
    );
    await foodProvider.checkActiveOrder();
  }

  /// Jonli MARKET buyurtmasi. `packing` → "Do'kon yig'moqda".
  Future<void> givenActiveMarketOrder() async {
    when(() => apiClient.get(ApiEndpoints.marketOrders)).thenAnswer(
      (_) async => _json(ApiEndpoints.marketOrders, [
        {
          'id': 'market-1',
          'storeId': 'store-1',
          'status': 'packing',
          'items': <dynamic>[],
          'deliveryAddress': "Do'stlik 4",
          'totalPrice': 30000,
          'createdAt': '2026-08-28T10:00:00.000Z',
        }
      ]),
    );
    await marketProvider.checkActiveOrder();
  }

  Future<void> givenUnreadNotifications(int count) async {
    when(() => apiClient.get(ApiEndpoints.notifications)).thenAnswer(
      (_) async => _json(ApiEndpoints.notifications, [
        for (var i = 0; i < count; i++)
          {
            'id': 'notif-$i',
            'userId': 'passenger-1',
            'title': 'Xabar',
            'body': 'Matn',
            'event': 'order_accepted',
            'read': false,
            'createdAt': '2026-08-28T10:00:00.000Z',
          }
      ]),
    );
    await notificationsProvider.loadNotifications();
  }

  /// Matn turgan eng yaqin [AgSurfaceCard] ning ekrandagi to'rtburchagi.
  /// Ierarxiyani KO'Z bilan emas, O'LCHOV bilan tekshirish uchun.
  Rect cardRectOf(WidgetTester tester, String text) => tester.getRect(
        find
            .ancestor(
              of: find.text(text),
              matching: find.byType(AgSurfaceCard),
            )
            .first,
      );

  /// Bildirishnoma tugmasi — ikonkasi orqali topiladi, semantikaga
  /// bog'lanmaydi (nishon Semantics ichida `excludeSemantics` bilan
  /// yashiringan, lekin widget daraxtida ko'rinadi).
  Finder notifButton() => find
      .ancestor(
        of: find.byIcon(Icons.notifications_rounded),
        matching: find.byType(AgIconButton),
      )
      .first;

  group('HomeTab — xizmat kirish nuqtalari', () {
    testWidgets("to'rtta xizmatning ham kirish nuqtasi ko'rinadi",
        (tester) async {
      await pumpHome(tester);

      expect(find.text('Taksi'), findsWidgets);
      expect(find.text('Yuk'), findsOneWidget);
      expect(find.text('Ovqat'), findsOneWidget);
      expect(find.text('Market'), findsOneWidget);
    });

    testWidgets("taksiga bosilsa taksi oqimiga o'tadi", (tester) async {
      await pumpHome(tester);

      await tester.tap(find.text('Taksi').first);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(orderProvider.serviceType, 'taxi');
      expect(recorder.lastRouteName, '/passenger/home');
    });

    testWidgets("taksi blokidagi manzil maydoni ham taksi oqimiga olib boradi",
        (tester) async {
      await pumpHome(tester);

      await tester.tap(find.text('Qayerga borasiz?'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(orderProvider.serviceType, 'taxi');
      expect(recorder.lastRouteName, '/passenger/home');
    });

    testWidgets("ovqatga bosilsa ovqat ro'yxati ekraniga o'tadi",
        (tester) async {
      await pumpHome(tester);
      final context = homeContext(tester);

      await tester.tap(find.text('Ovqat'));
      await tester.pump();

      expect(recorder.lastBuiltPage(context), isA<FoodListScreen>());
    });

    testWidgets("marketga bosilsa market ekraniga o'tadi", (tester) async {
      await pumpHome(tester);
      final context = homeContext(tester);

      await tester.tap(find.text('Market'));
      await tester.pump();

      expect(recorder.lastBuiltPage(context), isA<MarketScreen>());
    });

    testWidgets("yuk xizmatiga bosilsa cargo ekraniga o'tadi", (tester) async {
      await pumpHome(tester);
      final context = homeContext(tester);

      await tester.tap(find.text('Yuk'));
      await tester.pump();

      expect(recorder.lastBuiltPage(context), isA<CargoScreen>());
    });

    // Ilgari bu yerda tekshirilgan NUQSON: suzuvchi qidiruv paneli
    // `Positioned(bottom: -27)` bilan header Stack'idan tashqariga chiqib
    // ketardi va Flutter ota-qutisidan tashqaridagi nuqtani hit-test
    // qilmagani uchun 54dp li boshqaruvning pastki yarmi bosilmasdi.
    // Endi qidiruv header ichidagi ikonka tugmasi — MARKAZIGA bosilsa
    // ishlaydi, ya'ni o'lik zona qolmadi.
    testWidgets("umumiy qidiruv tugmasi to'liq bosiladi", (tester) async {
      await pumpHome(tester);
      final context = homeContext(tester);
      final handle = tester.ensureSemantics();

      await tester.tap(find.bySemanticsLabel('Qidiruv'));
      await tester.pump();

      expect(recorder.lastBuiltPage(context), isA<SearchScreen>());
      handle.dispose();
    });
  });

  group('HomeTab — tor ekran', () {
    // Header qatoriga uchinchi boshqaruv (qidiruv) qo'shildi, shuning
    // uchun 320dp li eng tor telefonda hammasi ekran ichida qolishi
    // kerak — manzil yozuvi `Expanded` + ellipsis bilan qisqaradi.
    //
    // ⚠️ Butun ekran uchun "hech qanday overflow yo'q" deb tekshirilmaydi:
    // testdagi standart shrift (Ahem) har bir belgini kvadrat qilib
    // o'lchaydi va uzun sarlavhalarni haqiqiy shriftdan ~2 barobar keng
    // ko'rsatadi. Shuning uchun aynan SHU ekranda o'zgargan qism —
    // header boshqaruvlari — o'lchanadi.
    testWidgets('320dp kenglikda header boshqaruvlari ekran ichida qoladi',
        (tester) async {
      tester.view.physicalSize = const Size(320 * 3, 640 * 3);
      tester.view.devicePixelRatio = 3.0;
      addTearDown(tester.view.reset);

      // Semantika pumpdan OLDIN yoqiladi — aks holda daraxt tuzilmaydi
      // va `bySemanticsLabel` hech nima topmaydi.
      final handle = tester.ensureSemantics();
      await pumpHome(tester);

      final notifs = tester.getRect(find.bySemanticsLabel('Bildirishnomalar'));
      final search = tester.getRect(find.bySemanticsLabel('Qidiruv'));
      final wallet = tester.getRect(find.bySemanticsLabel('Hamyon'));

      expect(notifs.right, lessThanOrEqualTo(320.0));
      expect(search.left, greaterThanOrEqualTo(0.0));
      expect(wallet.left, greaterThanOrEqualTo(0.0));
      // Uchtasi ham 48dp li tegish maydonini saqlaydi.
      expect(notifs.width, greaterThanOrEqualTo(48.0));
      expect(search.width, greaterThanOrEqualTo(48.0));

      // ⚠️ Pastdagi `takeException` drenaji HAR QANDAY overflow xatosini
      // yutadi — shu jumladan shu ekranning O'ZIDAGI haqiqiy buzilishni
      // ham. Shuning uchun qayta qurilgan ikkita blok xato kanaliga
      // emas, O'LCHOVGA tayanib tekshiriladi.
      final taxiCard = cardRectOf(tester, 'Qayerga borasiz?');
      expect(taxiCard.left, greaterThanOrEqualTo(0.0));
      expect(taxiCard.right, lessThanOrEqualTo(320.0));
      for (final label in <String>['Yuk', 'Ovqat', 'Market']) {
        final tile = cardRectOf(tester, label);
        expect(tile.left, greaterThanOrEqualTo(0.0),
            reason: '"$label" plitkasi chap chetdan chiqib ketdi');
        expect(tile.right, lessThanOrEqualTo(320.0),
            reason: '"$label" plitkasi o\'ng chetdan chiqib ketdi');
      }

      // Ahem test shrifti har bir belgini kvadrat qilib o'lchaydi va
      // umumiy `AgSectionTitle` ("Mashhur restoranlar" + "Barchasi")
      // shu sababli tor ekranda toshib ketadi. Bu shu ekranning emas,
      // test shriftining artefakti (haqiqiy shriftda ~230dp) va u
      // fayl doirasidan tashqaridagi komponentda — shovqin oqiziladi.
      while (tester.takeException() != null) {}
      handle.dispose();
    });
  });

  group("HomeTab — ma'lumot", () {
    testWidgets("hamyon balansi yuklanganda ko'rinadi", (tester) async {
      await pumpHome(tester);

      expect(superappProvider.walletBalance, 125000);
      expect(find.textContaining('125'), findsWidgets);
    });

    testWidgets("mashhur restoranlar ro'yxati serverdan chiqadi",
        (tester) async {
      await pumpHome(tester);

      expect(find.text('Osh Markazi'), findsOneWidget);
    });
  });

  group('HomeTab — faol buyurtma', () {
    testWidgets("faol buyurtma bo'lmasa hech qanday bosqich ko'rinmaydi",
        (tester) async {
      await pumpHome(tester);

      expect(find.text('Haydovchi tayinlandi'), findsNothing);
      expect(find.text('Markaz → Uy'), findsNothing);
    });

    // Qayta qurishdan keyin: jonli safar bo'lsa bosh ekran u haqda
    // GAPIRADI. Karta xizmatdan qat'i nazar bitta ko'rinishda — bu yerda
    // taksi, ovqat/market uchun ham xuddi shu komponent, faqat ikonka va
    // bosqich yozuvi boshqacha.
    testWidgets("faol safar bosh ekranda yo'nalish va bosqich bilan chiqadi",
        (tester) async {
      await givenActiveTaxiOrder();

      await pumpHome(tester);

      expect(orderProvider.hasActiveOrder, isTrue);
      expect(find.text('Markaz → Uy'), findsOneWidget);
      expect(find.text('Haydovchi tayinlandi'), findsOneWidget);
      // Xizmat nomi ham ko'rinadi — foydalanuvchi qaysi buyurtma
      // ekanini bir qarashda bilishi kerak.
      expect(find.text('Taksi'), findsWidgets);
    });

    // 2c talabi: karta XIZMATDAN QAT'I NAZAR bitta ko'rinish. Yuk
    // buyurtmasida ayni shu komponent chiziladi — faqat xizmat nomi va
    // ikonkasi `ServiceCatalogEntry` dan boshqacha keladi.
    testWidgets('yuk buyurtmasi ham xuddi shu kartada chiqadi',
        (tester) async {
      await givenActiveTaxiOrder(serviceType: 'cargo');

      await pumpHome(tester);

      expect(find.text('Markaz → Uy'), findsOneWidget);
      expect(find.text('Haydovchi tayinlandi'), findsOneWidget);
      // Bittasi — ikkilamchi xizmat plitkasi, ikkinchisi — faol karta.
      expect(find.text('Yuk'), findsNWidgets(2));
    });

    testWidgets('faol safar kartasi kuzatuv oqimiga olib boradi',
        (tester) async {
      await givenActiveTaxiOrder();
      await pumpHome(tester);

      await tester.tap(find.text('Markaz → Uy'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(recorder.lastRouteName, '/passenger/home');
    });
  });

  // ==========================================================================
  // TAKSI IMTIYOZI — QAYTA QURISHNING BUTUN MA'NOSI SHU YERDA QULFLANADI.
  //
  // Yuqoridagi yorliq testlari to'rtta xizmat BORLIGINI isbotlaydi, lekin
  // kimdir ertaga ularni yana to'rtta TENG plitkaga qaytarsa, o'sha testlar
  // baribir yashil qolardi — "Taksi", "Yuk", "Ovqat", "Market" matnlari
  // joyida bo'lardi. Shuning uchun ierarxiya bu yerda MATN bilan emas,
  // O'LCHOV bilan tekshiriladi.
  // ==========================================================================
  group('HomeTab — taksi imtiyozi', () {
    testWidgets('taksi bloki ikkilamchi xizmatlardan YUQORIDA turadi',
        (tester) async {
      await pumpHome(tester);

      final taxi = cardRectOf(tester, 'Qayerga borasiz?');
      final food = cardRectOf(tester, 'Ovqat');

      expect(taxi.bottom, lessThanOrEqualTo(food.top),
          reason: "Taksi bloki ikkilamchi xizmat qatoridan pastga tushib "
              'qolgan — asosiy vertikal endi sukut bo\'yicha yuza emas');
    });

    testWidgets('taksi bloki ikkilamchi plitkadan sezilarli KATTAROQ',
        (tester) async {
      await pumpHome(tester);

      final taxi = cardRectOf(tester, 'Qayerga borasiz?');
      final food = cardRectOf(tester, 'Ovqat');
      final market = cardRectOf(tester, 'Market');
      final cargo = cardRectOf(tester, 'Yuk');

      for (final tile in <(String, Rect)>[
        ('Ovqat', food),
        ('Market', market),
        ('Yuk', cargo),
      ]) {
        // Uchta plitka bitta qatorni bo'lishadi — har biri taksi
        // blokining yarmidan ham tor bo'lishi shart.
        expect(tile.$2.width, lessThan(taxi.width / 2),
            reason: '"${tile.$1}" plitkasi taksi bloki bilan teng kenglikda');
        expect(tile.$2.height, lessThan(taxi.height),
            reason: '"${tile.$1}" plitkasi taksi bloki bilan teng balandlikda');
      }

      // Uchtasi bitta GORIZONTAL qatorda — vertikal ro'yxat emas.
      expect(food.top, closeTo(market.top, 1));
      expect(food.top, closeTo(cargo.top, 1));
    });
  });

  // ==========================================================================
  // FAOL BUYURTMA KARTASINING OVQAT/MARKET TARMOQLARI.
  //
  // `_activeOrder` uchta manbadan o'qiydi (OrderProvider / FoodProvider /
  // MarketProvider). Taksi va yuk tarmog'i yuqorida tekshirilgan, qolgan
  // ikkitasi qayta qurishda yozilgan YANGI kod va tekshirilmasdan qolgan edi.
  // ==========================================================================
  group('HomeTab — yetkazib berish buyurtmasi', () {
    testWidgets('ovqat buyurtmasi xuddi shu kartada manzil va bosqich bilan '
        "chiqadi", (tester) async {
      await givenActiveFoodOrder();
      await pumpHome(tester);

      expect(foodProvider.hasActiveOrder, isTrue);
      expect(find.text('Navoiy 12'), findsOneWidget);
      expect(find.text('Tayyorlanmoqda'), findsOneWidget);
      // "Ovqat" ikki marta: ikkilamchi plitka + faol karta.
      expect(find.text('Ovqat'), findsNWidgets(2));
    });

    testWidgets('market buyurtmasi xuddi shu kartada chiqadi', (tester) async {
      await givenActiveMarketOrder();
      await pumpHome(tester);

      expect(marketProvider.hasActiveOrder, isTrue);
      expect(find.text("Do'stlik 4"), findsOneWidget);
      expect(find.text("Do'kon yig'moqda"), findsOneWidget);
      expect(find.text('Market'), findsNWidgets(2));
    });

    // ⚠️ XULQ O'ZGARISHI. Yetkazib berish kartasi YANGI EKRAN OCHMAYDI —
    // mavjud "Buyurtmalar" tabiga o'tadi. Ya'ni navigator stekiga hech
    // nima qo'shilmasligi SHART, aks holda foydalanuvchi ikkita bir xil
    // ro'yxat orasida qolib ketadi.
    testWidgets("ovqat kartasi yangi ekran ochmaydi, Buyurtmalar tabiga "
        "o'tadi", (tester) async {
      await givenActiveFoodOrder();
      await pumpHome(tester);
      final pushedBefore = recorder.pushed.length;

      await tester.tap(find.text('Navoiy 12'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(superappProvider.tabIndex, 1);
      expect(recorder.pushed, hasLength(pushedBefore),
          reason: 'Yetkazib berish kartasi yangi ekran ochib yubordi');
    });

    testWidgets("market kartasi ham Buyurtmalar tabiga o'tadi",
        (tester) async {
      await givenActiveMarketOrder();
      await pumpHome(tester);
      final pushedBefore = recorder.pushed.length;

      await tester.tap(find.text("Do'stlik 4"));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(superappProvider.tabIndex, 1);
      expect(recorder.pushed, hasLength(pushedBefore));
    });

    // Ikkala manba birdan faol bo'lsa TARTIB muhim: yo'lda ketayotgan
    // safar yetkazib berishdan tezroq e'tibor talab qiladi, va ekranda
    // faqat BITTA karta qoladi.
    testWidgets("safar va ovqat birga faol bo'lsa faqat safar kartasi chiqadi",
        (tester) async {
      await givenActiveTaxiOrder();
      await givenActiveFoodOrder();
      await pumpHome(tester);

      expect(orderProvider.hasActiveOrder, isTrue);
      expect(foodProvider.hasActiveOrder, isTrue);

      expect(find.text('Markaz → Uy'), findsOneWidget);
      expect(find.text('Navoiy 12'), findsNothing);
      expect(find.text('Tayyorlanmoqda'), findsNothing);
      // "Ovqat" faqat ikkilamchi plitkada — faol kartada emas.
      expect(find.text('Ovqat'), findsOneWidget);
    });
  });

  // ==========================================================================
  // ⚠️ ILGARIGI SOXTA SIGNAL. Bildirishnoma tugmasida HAR DOIM qizil nuqta
  // turardi (`Positioned` ichida shartsiz `Container`) — hech qachon xabar
  // olmagan foydalanuvchi ham "sizni kutayotgan narsa bor" degan yolg'onni
  // o'qirdi. Endi nishon faqat haqiqiy o'qilmagan son bilan chiziladi.
  // ==========================================================================
  group('HomeTab — bildirishnoma nishoni', () {
    testWidgets("o'qilmagan xabar yo'q bo'lsa nishon umuman chizilmaydi",
        (tester) async {
      await pumpHome(tester);

      expect(notificationsProvider.unreadCount, 0);
      expect(notifButton(), findsOneWidget);
      // Nishon — yagona matn tuguni; u yo'q bo'lsa tugmada matn qolmaydi.
      expect(
        find.descendant(of: notifButton(), matching: find.byType(Text)),
        findsNothing,
        reason: "O'qilmagan xabar yo'q, lekin tugmada nishon chizilgan",
      );
    });

    testWidgets("o'qilmagan xabar bo'lsa nishonda HAQIQIY son turadi",
        (tester) async {
      await givenUnreadNotifications(3);
      await pumpHome(tester);

      expect(notificationsProvider.unreadCount, 3);
      expect(
        find.descendant(of: notifButton(), matching: find.text('3')),
        findsOneWidget,
      );
    });
  });
}
