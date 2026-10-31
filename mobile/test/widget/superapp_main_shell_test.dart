// XARAKTERISTIK TESTLAR — `SuperappShell` (main_shell.dart).
//
// Bu ekranda ilgari BITTA ham test yo'q edi, ya'ni pastki navigatsiyani
// qayta qurish regressiyani yashirishi mumkin edi. Shu sababli quyidagi
// testlar avval YOZILDI va HOZIRGI xulq-atvorga qarshi o'tkazildi, keyin
// vizual qayta qurish boshlandi. Ular uchta shartnomani qulflaydi:
//
//   1. pastki nav'da to'rtta element bor va har birining YORLIG'I doim
//      ko'rinadi (faqat ikonali nav ko'p xizmatli ilovada har sessiyada
//      qayta o'rganishga majbur qiladi);
//   2. elementga tegilganda tanlangan tab o'zgaradi — ham provider
//      holatida, ham `IndexedStack` ko'rsatayotgan sahifada;
//   3. savat nishoni SONI bilan chiqadi va savat bo'sh bo'lsa umuman
//      ko'rinmaydi.
//
// Yorliq matnlari ("Savat", "Buyurtma") tab ICHIDA ham uchraydi
// (`CartScreen` sarlavhasi, `HomeTab` xizmat plitkasi), shuning uchun
// barcha finder'lar nav paneli ostiga chegaralangan — panel daraxtdagi
// yagona `BackdropFilter`.
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/notifications/notifications_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/models/cart_item.dart';
import 'package:angren_taxi/features/superapp/screens/main_shell.dart';
import 'package:angren_taxi/features/superapp/state/food_provider.dart';
import 'package:angren_taxi/features/superapp/state/market_provider.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

/// Har bir tab ochilishida o'z ma'lumotini so'raydi. Shell testi uchun
/// MAZMUN emas, NAVIGATSIYA muhim — shuning uchun har bir yo'l bo'sh,
/// ammo to'g'ri shakldagi javob qaytaradi.
Response<dynamic> _emptyFor(String path) {
  final Map<String, dynamic> data;
  if (path == ApiEndpoints.paymentsWallet) {
    data = {'userId': 'user-1', 'balance': 0};
  } else if (path == ApiEndpoints.paymentsTransactions) {
    data = {'transactions': <dynamic>[], 'total': 0, 'page': 1, 'limit': 20};
  } else if (path == ApiEndpoints.settingsPublic) {
    data = {'deliveryFee': 7000};
  } else if (path == ApiEndpoints.orderHistory) {
    data = {'orders': <dynamic>[], 'total': 0, 'page': 1, 'limit': 20};
  } else {
    data = const {};
  }
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {
      'success': true,
      // Ro'yxat qaytaradigan yo'llar (restoranlar, buyurtmalar tarixi)
      // konvertda massiv kutadi.
      'data': data.isEmpty ? <dynamic>[] : data,
    },
    statusCode: 200,
  );
}

CartItem _item(String id, {int qty = 1}) => CartItem(
      id: id,
      name: 'Mahsulot $id',
      price: 18000,
      qty: qty,
      icon: Icons.fastfood_rounded,
      color: kInk,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;
  late SuperappProvider superapp;
  late FoodProvider food;
  late MarketProvider market;
  late OrderProvider order;
  late AuthProvider auth;
  late NotificationsProvider notifications;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();

    apiClient = MockApiClient();

    Response<dynamic> answer(Invocation i) =>
        _emptyFor(i.positionalArguments.first as String);

    when(() => apiClient.get(any())).thenAnswer((i) async => answer(i));
    when(() => apiClient.get(any(), params: any(named: 'params')))
        .thenAnswer((i) async => answer(i));

    superapp = SuperappProvider(apiClient: apiClient);
    food = FoodProvider(apiClient: apiClient, socketService: SocketService());
    market =
        MarketProvider(apiClient: apiClient, socketService: SocketService());
    order = OrderProvider(apiClient: apiClient, socketService: SocketService());
    notifications = NotificationsProvider(apiClient: apiClient);
    auth = AuthProvider(
      apiClient: apiClient,
      localStorage: LocalStorage(prefs),
      socketService: SocketService(),
      navigatorKey: GlobalKey<NavigatorState>(),
    );
  });

  /// Nav paneli — daraxtdagi yagona `BackdropFilter`. Barcha yorliq
  /// finder'lari shu ostiga chegaralanadi, aks holda tab ichidagi bir xil
  /// matn hisobga qo'shilib ketadi.
  final navBar = find.byType(BackdropFilter);

  Finder navLabel(String label) =>
      find.descendant(of: navBar, matching: find.text(label));

  Future<void> pumpShell(
    WidgetTester tester, {
    EdgeInsets viewPadding = EdgeInsets.zero,
  }) async {
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<SuperappProvider>.value(value: superapp),
          ChangeNotifierProvider<FoodProvider>.value(value: food),
          ChangeNotifierProvider<MarketProvider>.value(value: market),
          ChangeNotifierProvider<OrderProvider>.value(value: order),
          ChangeNotifierProvider<AuthProvider>.value(value: auth),
          ChangeNotifierProvider<NotificationsProvider>.value(
            value: notifications,
          ),
        ],
        child: MaterialApp(
          home: MediaQuery(
            data: MediaQueryData(padding: viewPadding),
            child: const SuperappShell(),
          ),
        ),
      ),
    );
    // `pumpAndSettle` emas: `HomeTab` da `flutter_animate` animatsiyalari
    // bor va ular testni cheksiz kutishga majbur qilishi mumkin.
    for (var i = 0; i < 12; i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }
  }

  testWidgets('pastki nav to\'rtta element ko\'rsatadi va yorliqlar doim ko\'rinadi',
      (tester) async {
    await pumpShell(tester);

    expect(navBar, findsOneWidget);
    for (final label in ['Asosiy', 'Buyurtma', 'Savat', 'Profil']) {
      expect(navLabel(label), findsOneWidget, reason: '"$label" yorlig\'i yo\'q');
    }

  });

  testWidgets('elementga tegilganda tanlangan tab o\'zgaradi', (tester) async {
    await pumpShell(tester);

    final stack = find.byType(IndexedStack).first;
    expect(superapp.tabIndex, 0);
    expect(tester.widget<IndexedStack>(stack).index, 0);

    await tester.tap(navLabel('Savat'));
    await tester.pump();

    expect(superapp.tabIndex, 2);
    expect(tester.widget<IndexedStack>(stack).index, 2);

    await tester.tap(navLabel('Profil'));
    await tester.pump();

    expect(superapp.tabIndex, 3);
    expect(tester.widget<IndexedStack>(stack).index, 3);

  });

  testWidgets('savat nishoni sonni ko\'rsatadi, savat bo\'sh bo\'lsa yo\'qoladi',
      (tester) async {
    await pumpShell(tester);

    // Bo'sh savatda nishon umuman chizilmaydi.
    expect(navLabel('1'), findsNothing);

    superapp.addToCart(_item('a', qty: 2));
    superapp.addToCart(_item('b'));
    await tester.pump();

    // 2 + 1 = 3 dona — nishon DONA sonini ko'rsatadi, qator sonini emas.
    expect(superapp.cartCount, 3);
    expect(navLabel('3'), findsOneWidget);

    superapp.clearCart();
    await tester.pump();

    expect(navLabel('3'), findsNothing);

  });

  // --- Qayta qurishdan KEYIN qo'shilgan regressiya qulflari ---------------
  //
  // Rang qoidasi oson buziladi va hech qanday testsiz sezilmaydi, shuning
  // uchun u yerda ham qulf bor.

  testWidgets(
      'tanlangan tab kPrimary; tanlanmaganda IKONKA kInkSubtle, YORLIQ kInkMuted',
      (tester) async {
    await pumpShell(tester);

    Color? labelColor(String label) =>
        tester.widget<Text>(navLabel(label)).style?.color;

    Color? iconColor(IconData icon) => tester
        .widget<Icon>(find.descendant(of: navBar, matching: find.byIcon(icon)))
        .color;

    // Tanlangan (0-tab): ikonka ham, yorliq ham kPrimary.
    expect(labelColor('Asosiy'), kPrimary);
    expect(iconColor(Icons.home_rounded), kPrimary);

    // Tanlanmagan: ikonka kInkSubtle (grafik element, 3.67:1 — 1.4.11 uchun
    // yetarli), YORLIQ esa kInkMuted (5.47:1). Ikkisi bir xil BO'LMASLIGI
    // kerak — kInkSubtle 11px yozuvda taqiqlangan.
    expect(iconColor(Icons.person_outline_rounded), kInkSubtle);
    expect(labelColor('Profil'), kInkMuted);
    expect(labelColor('Profil'), isNot(kInkSubtle));

  });

  testWidgets('savat nishoni kError fonda oq raqam', (tester) async {
    await pumpShell(tester);

    superapp.addToCart(_item('a'));
    await tester.pump();

    final badgeText = tester.widget<Text>(navLabel('1'));
    expect(badgeText.style?.color, kOnPrimary);

    final box = tester.widget<Container>(
      find.ancestor(of: navLabel('1'), matching: find.byType(Container)).first,
    );
    expect((box.decoration! as BoxDecoration).color, kError);

  });

  testWidgets('tanlangan tab ortida agTint tabletka, tanlanmaganda shaffof',
      (tester) async {
    await pumpShell(tester);

    // Uchinchi signal — YUZA. Rang ko'r foydalanuvchi uchun ham, quyoshda
    // ekranga qaragan haydovchi uchun ham tanlangan tab shakl bilan
    // ajralib turishi kerak, faqat rang bilan emas.
    Color? pill(IconData icon) {
      final box = tester.widget<AnimatedContainer>(
        find
            .ancestor(
              of: find.descendant(of: navBar, matching: find.byIcon(icon)),
              matching: find.byType(AnimatedContainer),
            )
            .first,
      );
      return (box.decoration! as BoxDecoration).color;
    }

    expect(pill(Icons.home_rounded), kMintTint);
    expect(pill(Icons.person_outline_rounded), Colors.transparent);
  });

  testWidgets('nav pastki xavfsiz zona USTIDA turadi, uning ostida emas',
      (tester) async {
    await pumpShell(tester);
    final flat = tester.getRect(navBar).bottom;

    await pumpShell(tester, viewPadding: const EdgeInsets.only(bottom: 34));
    final inset = tester.getRect(navBar).bottom;

    // Jest paneli bor qurilmada nav AYNAN inset qadar yuqoriga ko'chadi —
    // aks holda u panelning ostida qolib, oxirgi tab bosilmaydi.
    expect(flat - inset, moreOrLessEquals(34, epsilon: 0.5));
  });

  testWidgets('tabga tegish haptik javob beradi', (tester) async {
    final calls = <MethodCall>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        calls.add(call);
        return null;
      },
    );
    addTearDown(() => tester.binding.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, null));

    await pumpShell(tester);
    calls.clear();

    await tester.tap(navLabel('Profil'));
    await tester.pump();

    expect(
      calls.where((c) => c.method == 'HapticFeedback.vibrate'),
      isNotEmpty,
      reason: 'tab almashuvi barmoqda sezilmadi',
    );
  });
}
