// Kutish hisoblagichi — IKKALA ilovada.
//
// ⚠️ NIMANI QO'RIQLAYDI. Kutish endi PUL undiradi, va bu toifadagi eng
// nizoli raqam. Uchta xatti-harakat buzilmasligi kerak:
//
//   1. Hisoblagich SERVERDAGI `arrivedAt` dan hisoblanadi, ekran
//      ochilgan lahzadan EMAS. Ilgari `Timer.periodic` noldan boshlanardi
//      va ilova qayta ishga tushsa raqam nolga qaytardi — aynan shu
//      nuqson tuzatilmoqda. Testlar ekranni ALLAQACHON ketayotgan
//      kutish bilan ochadi: lokal sanoqda bu holat "0 soniya" berardi.
//   2. Haydovchi va yo'lovchi BIR XIL sonni ko'radi — ikkalasi ham
//      bitta `arrivedAt` va bitta yaxlitlash qoidasidan chiqadi.
//   3. `arrivedAt = null` (eski buyurtma / "keldim" bosilmagan) — blok
//      UMUMAN chizilmaydi.
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/safety/sos_service.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/arrived_screen.dart';
import 'package:angren_taxi/features/passenger/screens/active_order_view.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

class MockApiClient extends Mock implements ApiClient {}

const String _orderId = 'order-1';

/// Buyurtma javobi — backend `attachDisplayFields` chiqaradigan shakl:
/// `arrivedAt`, `freeWaitMinutes`, `waitingPricePerMinute` ILDIZDA turadi,
/// `tariff` ichida emas.
Map<String, dynamic> _orderJson({
  required Duration? waitedFor,
  int freeWaitMinutes = 3,
  int waitingPricePerMinute = 500,
}) {
  return {
    'id': _orderId,
    'passengerId': 'passenger-1',
    'passenger': {
      'firstName': 'Aziz',
      'lastName': 'Karimov',
      'phone': '+998900000000',
    },
    'pickup': {
      'address': "Angren, Bobur ko'chasi, 10",
      'lat': 41.0167,
      'lng': 70.1436,
    },
    'dropoff': {
      'address': 'Angren, Mustaqillik maydoni',
      'lat': 41.0200,
      'lng': 70.1500,
    },
    'status': 'arrived',
    'estimatedPrice': 20000.0,
    'createdAt': '2026-08-29T09:00:00.000Z',
    // ⚠️ `now - waitedFor`: ekran ALLAQACHON ketayotgan kutish ustiga
    // ochiladi. Lokal sanoqli eski kodda bu yerda har doim nol chiqardi.
    'arrivedAt': waitedFor == null
        ? null
        : DateTime.now().toUtc().subtract(waitedFor).toIso8601String(),
    'freeWaitMinutes': freeWaitMinutes,
    'waitingPricePerMinute': waitingPricePerMinute,
  };
}

Response<dynamic> _jsonResponse(String path, Map<String, dynamic> data) {
  return Response<dynamic>(
    requestOptions: RequestOptions(path: path),
    data: {'success': true, 'data': data},
    statusCode: 200,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late MockApiClient apiClient;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
  });

  setUp(() {
    SharedPreferences.setMockInitialValues({});
    apiClient = MockApiClient();
  });

  // ==========================================================================
  // HAYDOVCHI
  // ==========================================================================

  /// `DriverProvider.activeOrder` ni tarmoqsiz urug'lantiradi: `acceptOrder`
  /// javobi soxta qilinadi, ya'ni provider haqiqiy `Order.fromJson` dan
  /// o'tadi va kutish maydonlari haqiqiy yo'l bilan keladi.
  Future<DriverProvider> seedDriverProvider(Map<String, dynamic> json) async {
    final prefs = await SharedPreferences.getInstance();
    final provider = DriverProvider(
      apiClient: apiClient,
      socketService: SocketService(),
      locationService: LocationService(),
      localStorage: LocalStorage(prefs),
    );
    when(() => apiClient.patch(ApiEndpoints.acceptOrder(_orderId)))
        .thenAnswer((_) async => _jsonResponse(
              ApiEndpoints.acceptOrder(_orderId),
              json,
            ));
    await provider.acceptOrder(_orderId);
    return provider;
  }

  Future<void> pumpArrivedScreen(
    WidgetTester tester,
    DriverProvider provider, {
    DateTime Function()? clock,
  }) async {
    await tester.pumpWidget(
      ChangeNotifierProvider<DriverProvider>.value(
        value: provider,
        child: MaterialApp(home: ArrivedScreen(clock: clock)),
      ),
    );
    await tester.pump();
  }

  group('Haydovchi — ArrivedScreen kutish bloki', () {
    testWidgets(
      'bepul oyna ichida: qolgan vaqt serverdagi arrivedAt dan hisoblanadi',
      (tester) async {
        // 1:30 kutilgan → 1:30 bepul qolgan. Ekran endi ochildi, lekin
        // sanoq nolda EMAS — bu tuzatilgan nuqsonning o'zi.
        final provider = await seedDriverProvider(
          _orderJson(waitedFor: const Duration(seconds: 90)),
        );
        await pumpArrivedScreen(tester, provider);

        expect(find.text('Bepul kutish'), findsOneWidget);
        expect(find.text('1:30'), findsOneWidget);
        // Hali haq yo'q — summa ko'rsatilmaydi.
        expect(find.textContaining("+"), findsNothing);
        // Keyin qancha turishi OLDINDAN aytiladi.
        expect(
          find.textContaining(Formatters.formatSom(500)),
          findsOneWidget,
        );
      },
    );

    testWidgets(
      'bepul oyna tugagach: qolgan vaqt o\'rniga YIG\'ILGAN SUMMA',
      (tester) async {
        // 7:10 → ceil(7.17) = 8, 8 - 3 = 5 daqiqa × 500 = 2500 so'm.
        final provider = await seedDriverProvider(
          _orderJson(waitedFor: const Duration(minutes: 7, seconds: 10)),
        );
        await pumpArrivedScreen(tester, provider);

        expect(find.text('Kutish haqi'), findsOneWidget);
        expect(
          find.text('+${Formatters.formatSom(2500)}'),
          findsOneWidget,
        );
        // Holat o'zgardi: "Bepul kutish" yorlig'i endi yo'q.
        expect(find.text('Bepul kutish'), findsNothing);
        // Jami kutilgan vaqt hamon ko'rinadi — haydovchi "yo'lovchi
        // kelmadi" qarorini shu raqamga qarab qabul qiladi.
        expect(find.textContaining('Jami 7:10'), findsOneWidget);
      },
    );

    testWidgets(
      'arrivedAt = null (eski buyurtma): blok UMUMAN chizilmaydi',
      (tester) async {
        final provider = await seedDriverProvider(
          _orderJson(waitedFor: null),
        );
        await pumpArrivedScreen(tester, provider);

        expect(find.text('Bepul kutish'), findsNothing);
        expect(find.text('Kutish haqi'), findsNothing);
        expect(find.byIcon(Icons.timer_outlined), findsNothing);
        expect(find.byIcon(Icons.timer), findsNothing);
        // Ekranning qolgani ishlaydi.
        expect(find.byType(ArrivedScreen), findsOneWidget);
      },
    );

    testWidgets(
      'tarifning O\'Z qiymatlari ishlatiladi, standart emas',
      (tester) async {
        // Bepul 5 daqiqa, daqiqasiga 700: ceil(7.17) = 8, 8 - 5 = 3 → 2100.
        final provider = await seedDriverProvider(
          _orderJson(
            waitedFor: const Duration(minutes: 7, seconds: 10),
            freeWaitMinutes: 5,
            waitingPricePerMinute: 700,
          ),
        );
        await pumpArrivedScreen(tester, provider);

        expect(
          find.text('+${Formatters.formatSom(2100)}'),
          findsOneWidget,
        );
      },
    );

    testWidgets('hisoblagich sekundiga qayta chiziladi', (tester) async {
      // 2:58 → 0:02 qolgan; ikki soniyadan keyin oyna yopiladi va blok
      // "hisoblanmoqda" holatiga o'tadi. Timer FAQAT chizadi — vaqt
      // baribir `arrivedAt` dan hisoblanadi.
      // ⚠️ Soat QOTIRILADI. `tester.pump(3s)` faqat TAYMERLARNI suradi,
      // `DateTime.now()` ni emas — shu sababli boshqariladigan soat
      // bo'lmasa hisob umuman o'zgarmasdi va bu test hech narsani
      // isbotlamasdi.
      final arrivedAt = DateTime.now().subtract(const Duration(seconds: 178));
      var fakeNow = DateTime.now();

      final provider = await seedDriverProvider(
        _orderJson(waitedFor: const Duration(seconds: 178)),
      );
      await pumpArrivedScreen(tester, provider, clock: () => fakeNow);

      expect(find.text('Bepul kutish'), findsOneWidget);

      // Uch soniya "o'tadi": bepul oyna (180s) yopiladi va to'rtinchi
      // daqiqa boshlanadi — birinchi haqli daqiqa.
      fakeNow = arrivedAt.add(const Duration(seconds: 181));
      await tester.pump(const Duration(seconds: 3));

      expect(find.text('Kutish haqi'), findsOneWidget);
      expect(find.text('+${Formatters.formatSom(500)}'), findsOneWidget);
    });
  });

  // ==========================================================================
  // YO'LOVCHI
  // ==========================================================================

  Future<void> pumpActiveOrderView(
    WidgetTester tester,
    Order order,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ActiveOrderView(
            order: order,
            driverLocation: ValueNotifier<LatLng?>(null),
            isBusy: false,
            onCancel: (_) {},
            sosService: SosService(apiClient: apiClient),
            fallbackLocation: const LatLng(41.0167, 70.1436),
          ),
        ),
      ),
    );
    // ⚠️ IKKI MARTA pump: `ActiveOrderView` kirish animatsiyasi uchun
    // `flutter_animate` ishlatadi va u qurish paytida NOL davomiylikdagi
    // taymer rejalashtiradi. Bitta kadrdan keyin u hali otilmagan bo'ladi
    // va test tugaganda "A Timer is still pending" bilan yiqiladi.
    // Kirish animatsiyalari bosqichma-bosqich, ya'ni bitta emas, bir
    // nechta taymer bor — shuning uchun nol kadr emas, HAQIQIY davomiylik
    // pump qilinadi. Bu kutish hisobini SURMAYDI: `computeWaitingCharge`
    // haqiqiy `DateTime.now()` dan o'qiydi, test soati esa faqat
    // taymerlarni oldinga suradi. `pumpAndSettle` ishlatib
    // bo'lmaydi: kutish hisoblagichi DAVRIY taymer va u hech qachon
    // tinchimaydi, ya'ni `pumpAndSettle` muddatsiz osilib qolardi.
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
  }

  group("Yo'lovchi — ActiveOrderView kutish bloki", () {
    testWidgets(
      'bepul oyna ichida: qolgan vaqt va keyingi narx ko\'rsatiladi',
      (tester) async {
        await pumpActiveOrderView(
          tester,
          Order.fromJson(_orderJson(waitedFor: const Duration(seconds: 90))),
        );

        expect(find.text('Bepul kutish'), findsOneWidget);
        expect(find.text('1:30'), findsOneWidget);
        // ⚠️ Qat'iy narx kafolatidan TASHQARIDA ekani AYTILISHI shart.
        expect(
          find.textContaining("safar narxiga qo'shiladi"),
          findsOneWidget,
        );

        tester.takeException();
      },
    );

    testWidgets(
      'bepul oyna tugagach: yig\'ilgan summa real vaqtda ko\'rinadi',
      (tester) async {
        await pumpActiveOrderView(
          tester,
          Order.fromJson(
            _orderJson(waitedFor: const Duration(minutes: 7, seconds: 10)),
          ),
        );

        expect(find.text('Kutish haqi'), findsOneWidget);
        expect(find.text('+${Formatters.formatSom(2500)}'), findsOneWidget);
        expect(find.textContaining('Jami 7:10'), findsOneWidget);

        tester.takeException();
      },
    );

    testWidgets(
      'arrivedAt = null (eski buyurtma): blok UMUMAN chizilmaydi',
      (tester) async {
        await pumpActiveOrderView(
          tester,
          Order.fromJson(_orderJson(waitedFor: null)),
        );

        expect(find.text('Bepul kutish'), findsNothing);
        expect(find.text('Kutish haqi'), findsNothing);

        tester.takeException();
      },
    );

    testWidgets(
      'safar boshlangach hisoblagich TO\'XTAYDI (ikki marta undirilmaydi)',
      (tester) async {
        // Server tomonda kutish oynasi `trips.start_time` da yopiladi;
        // undan keyingi vaqt `timeFare` ga o'tadi. Ekran ham shu qoidaga
        // amal qilishi kerak, aks holda yo'lovchi o'sib borayotgan
        // kutish haqini ko'rib, chekda boshqa raqam topardi.
        final arrived =
            Order.fromJson(_orderJson(waitedFor: const Duration(minutes: 10)));
        await pumpActiveOrderView(
          tester,
          arrived.copyWith(status: OrderStatus.inProgress),
        );

        expect(find.text('Kutish haqi'), findsNothing);
        expect(find.text('Bepul kutish'), findsNothing);

        tester.takeException();
      },
    );
  });

  // ==========================================================================
  // IKKI EKRAN — BITTA RAQAM
  // ==========================================================================

  testWidgets(
    "haydovchi va yo'lovchi AYNAN bir xil summani ko'radi",
    (tester) async {
      // ⚠️ ENG MUHIM TEST. Ikki ekran bir xil buyurtmadan bir xil sonni
      // chiqarishi shart: ko'rinmay yig'ilgan yoki ikki xil ko'rsatilgan
      // haqqa albatta e'tiroz bildiriladi.
      final json = _orderJson(waitedFor: const Duration(minutes: 7, seconds: 10));
      final expected = '+${Formatters.formatSom(2500)}';

      final provider = await seedDriverProvider(json);
      await pumpArrivedScreen(tester, provider);
      expect(find.text(expected), findsOneWidget);

      await pumpActiveOrderView(tester, Order.fromJson(json));
      expect(find.text(expected), findsOneWidget);

      tester.takeException();
    },
  );
}
