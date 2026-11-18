import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/core/storage/secure_token_store.dart';
import 'package:angren_taxi/features/passenger/screens/receipt_screen.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Har bir so'rovni oddiy callback'ga uzatadi — test backend'ni o'zi yozadi.
class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this.onFetch);

  final Future<ResponseBody> Function(RequestOptions options) onFetch;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) =>
      onFetch(options);

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await initializeDateFormatting('uz');
  });

  Map<String, dynamic> receiptPayload({Map<String, dynamic>? fare}) => {
        'orderId': '3f9c1d2a-0000-0000-0000-000000000000',
        'orderNumber': 'A3F9C1D2',
        'completedAt': '2026-08-12T09:31:00.000Z',
        'serviceType': 'taxi',
        'pickupAddress': 'Angren, Navoiy 12',
        'dropoffAddress': 'Angren, Do\'stlik 4',
        'waypoints': const <Map<String, dynamic>>[],
        'tariffId': 'tariff-komfort',
        'tariffName': 'Komfort',
        'distanceKm': 7.4,
        'durationMin': 18,
        'fare': fare,
        'surgeMultiplier': 1.0,
        'grossPrice': 31900,
        'discountAmount': 0,
        'promoCode': null,
        'tipAmount': 0,
        'total': 31900,
        'paymentMethod': 'wallet',
        'paymentStatus': 'completed',
        'unpaidAmount': 0,
        'driver': {
          'name': 'Alisher Karimov',
          'carModel': 'Chevrolet Cobalt',
          'carNumber': '01A123BC',
        },
      };

  Map<String, dynamic> fullFare() => {
        'baseFare': 8000,
        'distanceKm': 7.4,
        'pricePerKm': 2500,
        'distanceFare': 18500,
        'durationMin': 18,
        'pricePerMin': 300,
        'timeFare': 5400,
        'minPriceAdjustment': 0,
        'surgeMultiplier': 1.0,
        'surgeFare': 0,
        'maxPriceCap': 0,
        'total': 31900,
      };

  /// Kutish undirilgan safar: yo'l haqi 31 900 + kutish 2 500 = 34 400.
  /// Raqamlar ATAYLAB qo'lda qo'shiladi — test backend invariantini
  /// takrorlamasligi, uni TEKSHIRISHI kerak.
  Map<String, dynamic> fareWithWaiting() => {
        ...fullFare(),
        'waitingMinutes': 5,
        'waitingFare': 2500,
        'total': 34400,
      };

  /// [statuses] — ketma-ket javob kodlari: birinchi so'rovga birinchi kod.
  /// Shu orqali "xato → qayta urinish → muvaffaqiyat" yo'li tekshiriladi.
  Future<ApiClient> buildClient(
    List<int> statuses, {
    Map<String, dynamic>? payload,
    Duration delay = const Duration(milliseconds: 30),
  }) async {
    SharedPreferences.setMockInitialValues({});
    final prefs = await SharedPreferences.getInstance();
    final storage = LocalStorage(prefs, secureStore: InMemorySecureTokenStore());
    await storage.saveToken('token');

    var call = 0;
    final dio = Dio(BaseOptions(baseUrl: 'https://example.test'));
    dio.httpClientAdapter = _ScriptedAdapter((options) async {
      final status = statuses[call.clamp(0, statuses.length - 1)];
      call++;
      await Future<void>.delayed(delay);
      final body = status == 200
          ? jsonEncode({'success': true, 'data': payload ?? receiptPayload()})
          : jsonEncode({'success': false, 'message': 'Xatolik'});
      return ResponseBody.fromString(
        body,
        status,
        headers: {
          Headers.contentTypeHeader: [Headers.jsonContentType],
        },
      );
    });

    return ApiClient(
      storage,
      GlobalKey<NavigatorState>(),
      dio: dio,
      refreshDio: dio,
    );
  }

  Future<void> pumpScreen(WidgetTester tester, ApiClient client) {
    return tester.pumpWidget(
      MaterialApp(
        home: ReceiptScreen(orderId: 'order-1', apiClient: client),
      ),
    );
  }

  testWidgets('yuklanish paytida skeleton ko\'rsatiladi, spinner emas',
      (tester) async {
    final client = await buildClient([200], payload: receiptPayload(fare: fullFare()));
    await pumpScreen(tester, client);

    // Javob hali kelmagan: skeleton ekran o'quvchiga ham e'lon qilinadi.
    await tester.pump(const Duration(milliseconds: 5));
    expect(find.bySemanticsLabel('Chek yuklanmoqda'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);

    await tester.pumpAndSettle();
  });

  testWidgets('tarkibli chek qatorlarni tartibda ko\'rsatadi', (tester) async {
    final client = await buildClient([200], payload: receiptPayload(fare: fullFare()));
    await pumpScreen(tester, client);
    await tester.pumpAndSettle();

    expect(find.text('A3F9C1D2'), findsOneWidget);
    expect(find.text('Asos'), findsOneWidget);
    expect(find.textContaining('Masofa (7.4 km ×'), findsOneWidget);
    expect(find.textContaining('Vaqt (18 daq ×'), findsOneWidget);
    expect(find.text('Yakuniy'), findsOneWidget);
    // Chegirma va chaqim yo'q — oraliq "Jami" takrorlanmaydi.
    expect(find.text('Jami'), findsNothing);

    // Haydovchi kartasi ro'yxat oxirida — testda u ko'rinish maydonidan
    // tashqarida, shuning uchun pastga surib tekshiriladi.
    await tester.drag(find.byType(ListView), const Offset(0, -600));
    await tester.pumpAndSettle();
    expect(find.text('Alisher Karimov'), findsOneWidget);
    expect(find.text('Chevrolet Cobalt · 01A123BC'), findsOneWidget);
  });

  testWidgets('fare null bo\'lsa soxta tarkib emas, izoh chiqadi',
      (tester) async {
    final client = await buildClient([200], payload: receiptPayload());
    await pumpScreen(tester, client);
    await tester.pumpAndSettle();

    expect(
      find.textContaining('narx tarkibi saqlanmagan'),
      findsOneWidget,
    );
    expect(find.text('Asos'), findsNothing);
    expect(find.text('Yakuniy'), findsOneWidget);
  });

  // ⚠️ Kutish qatori NOL BO'LSA HAM turadi. Sabab: bu qat'iy narx
  // kafolatidan tashqaridagi yagona qator, ya'ni yo'lovchi ko'rsatilgandan
  // ortiq to'lashi mumkin bo'lgan yagona sabab. Qator yo'q bo'lsa, "mendan
  // kutish uchun pul olishdimi?" degan savolga chekda javob qolmaydi.
  testWidgets('kutish 0 bo\'lganda ham qator va qoida ko\'rinadi',
      (tester) async {
    final client =
        await buildClient([200], payload: receiptPayload(fare: fullFare()));
    await pumpScreen(tester, client);
    await tester.pumpAndSettle();

    expect(find.textContaining('Kutish (0 daq'), findsOneWidget);
    expect(find.textContaining('bepul vaqtdan oshmadi'), findsOneWidget);
    expect(
      find.textContaining('Kutish haqi belgilangan narxga kirmaydi'),
      findsOneWidget,
    );
  });

  testWidgets('kutish undirilganda qator jamiga qo\'shiladi', (tester) async {
    final payload = receiptPayload(fare: fareWithWaiting())
      ..['grossPrice'] = 34400
      ..['total'] = 34400;
    final client = await buildClient([200], payload: payload);
    await pumpScreen(tester, client);
    await tester.pumpAndSettle();

    expect(find.text('Kutish (5 daq × 500 so\'m)'), findsOneWidget);

    // ⚠️ Summa QO'LDA yozilmaydi: 'uz_UZ' guruh ajratkichi — uzilmas bo'shliq
    // (U+00A0), ya'ni "2 500 so'm" ni oddiy bo'shliq bilan yozgan test
    // jimgina topa olmay qolardi. Tekshirilayotgan narsa shakl emas, SON.
    expect(find.text(Formatters.formatSom(2500)), findsOneWidget);
    // Yo'l haqi qatorlari 31 900, kutish 2 500 — yakuniy AYNAN 34 400.
    expect(find.text('Yakuniy'), findsOneWidget);
    expect(find.text(Formatters.formatSom(34400)), findsOneWidget);
  });

  testWidgets('403 alohida holat — qayta urinish tugmasi yo\'q',
      (tester) async {
    final client = await buildClient([403]);
    await pumpScreen(tester, client);
    await tester.pumpAndSettle();

    expect(find.text('Bu chek sizga tegishli emas'), findsOneWidget);
    expect(find.text('Qayta urinish'), findsNothing);
  });

  testWidgets('xatodan keyin qayta urinish chekni yuklaydi', (tester) async {
    final client = await buildClient(
      [500, 200],
      payload: receiptPayload(fare: fullFare()),
    );
    await pumpScreen(tester, client);
    await tester.pumpAndSettle();

    expect(find.text('Qayta urinish'), findsOneWidget);

    await tester.tap(find.text('Qayta urinish'));
    await tester.pumpAndSettle();

    expect(find.text('A3F9C1D2'), findsOneWidget);
  });
}
