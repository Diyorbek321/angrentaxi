// `OrderProvider` ning rejalashtirilgan safar oqimi.
//
// Uchta xatti-harakat qulflanadi:
//   1. tanlangan vaqt UTC ISO da yuboriladi (mahalliy vaqt yuborilsa
//      O'zbekistonda 5 soatlik siljish bo'lardi);
//   2. rejalashtirilgan buyurtmada `activeOrder` O'RNATILMAYDI — aks holda
//      bosh ekran kuzatuv rejimiga qulflanardi;
//   3. buyurtmadan keyin tanlov TOZALANADI — aks holda keyingi oddiy safar
//      jimgina o'tgan vaqtga rejalashtirilardi va backend 400 qaytarardi.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _jsonResponse(String path, dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: path),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Map<String, dynamic> _orderJson({
  String id = 'order-1',
  String status = 'scheduled',
  String? scheduledAt,
}) =>
    {
      'id': id,
      'passengerId': 'passenger-1',
      'pickup': {'address': 'Pickup', 'lat': 40.75, 'lng': 72.34},
      'dropoff': {'address': 'Dropoff', 'lat': 40.76, 'lng': 72.35},
      'status': status,
      'estimatedPrice': 18000,
      'createdAt': '2026-08-19T10:00:00.000Z',
      if (scheduledAt != null) 'scheduledAt': scheduledAt,
    };

void main() {
  late MockApiClient apiClient;
  late OrderProvider provider;

  setUpAll(() {
    registerFallbackValue(RequestOptions(path: ''));
    registerFallbackValue(<String, dynamic>{});
  });

  setUp(() {
    apiClient = MockApiClient();
    provider = OrderProvider(apiClient: apiClient, socketService: SocketService());

    provider.setPendingPickup(
      const OrderLocation(address: 'Pickup', lat: 40.75, lng: 72.34),
    );
    provider.setPendingDropoff(
      const OrderLocation(address: 'Dropoff', lat: 40.76, lng: 72.35),
    );
    provider.selectTariff(
      const Tariff(
        id: 'tariff-1',
        name: 'Standard',
        description: 'Kundalik safar',
        baseFare: 3000,
        perKmRate: 1500,
        minFare: 5000,
      ),
    );
  });

  /// Oxirgi `POST /orders` chaqiruvining tanasi.
  Map<String, dynamic> capturedBody() =>
      verify(() => apiClient.post(ApiEndpoints.createOrder, data: captureAny(named: 'data')))
          .captured
          .last as Map<String, dynamic>;

  group('setScheduledAt', () {
    test('tanlov holatni yangilaydi', () {
      expect(provider.isScheduledBooking, isFalse);
      expect(provider.scheduledAt, isNull);

      final when = DateTime.now().add(const Duration(hours: 3));
      provider.setScheduledAt(when);

      expect(provider.isScheduledBooking, isTrue);
      expect(provider.scheduledAt, when);
    });

    test('null bilan "hozir" ga qaytadi', () {
      provider.setScheduledAt(DateTime.now().add(const Duration(hours: 3)));
      provider.setScheduledAt(null);

      expect(provider.isScheduledBooking, isFalse);
    });
  });

  group('createOrder — rejalashtirilgan', () {
    setUp(() {
      when(() => apiClient.post(ApiEndpoints.createOrder, data: any(named: 'data')))
          .thenAnswer((_) async => _jsonResponse(
                ApiEndpoints.createOrder,
                _orderJson(scheduledAt: '2026-08-20T03:00:00.000Z'),
              ));
    });

    test('scheduledAt ni UTC ISO-8601 da yuboradi', () async {
      final when = DateTime(2026, 8, 20, 8, 30);
      provider.setScheduledAt(when);

      await provider.createOrder();

      final body = capturedBody();
      expect(body['scheduledAt'], when.toUtc().toIso8601String());
      // UTC belgisi bilan tugashi shart — mahalliy vaqt yuborilsa backend
      // uni UTC deb o'qib safarni 5 soatga surib yuborardi.
      expect(body['scheduledAt'] as String, endsWith('Z'));
    });

    test('oddiy buyurtmada scheduledAt kaliti UMUMAN yuborilmaydi', () async {
      // `forbidNonWhitelisted` emas, lekin `null` yuborish backend
      // validatsiyasini keraksiz ishga soladi — kalit butunlay bo'lmasin.
      when(() => apiClient.post(ApiEndpoints.createOrder, data: any(named: 'data')))
          .thenAnswer((_) async => _jsonResponse(
                ApiEndpoints.createOrder,
                _orderJson(status: 'created'),
              ));

      await provider.createOrder();

      expect(capturedBody().containsKey('scheduledAt'), isFalse);
    });

    test('activeOrder O\'RNATILMAYDI, reja ro\'yxatga qo\'shiladi', () async {
      provider.setScheduledAt(DateTime.now().add(const Duration(hours: 3)));

      await provider.createOrder();

      expect(provider.activeOrder, isNull);
      expect(provider.hasActiveOrder, isFalse);
      expect(provider.scheduledOrders, hasLength(1));
      expect(provider.scheduledOrders.first.id, 'order-1');
    });

    test('muvaffaqiyatdan keyin tanlov TOZALANADI', () async {
      provider.setScheduledAt(DateTime.now().add(const Duration(hours: 3)));

      await provider.createOrder();

      expect(
        provider.isScheduledBooking,
        isFalse,
        reason: 'tozalanmasa keyingi oddiy safar o\'tgan vaqtga '
            'rejalashtirilib, backend 400 qaytarardi',
      );
    });

    test('oddiy buyurtmada activeOrder odatdagidek o\'rnatiladi', () async {
      when(() => apiClient.post(ApiEndpoints.createOrder, data: any(named: 'data')))
          .thenAnswer((_) async => _jsonResponse(
                ApiEndpoints.createOrder,
                _orderJson(status: 'searching'),
              ));

      await provider.createOrder();

      expect(provider.activeOrder, isNotNull);
      expect(provider.scheduledOrders, isEmpty);
    });
  });

  group('clearPendingOrder', () {
    test('tanlangan vaqtni ham tozalaydi', () {
      provider.setScheduledAt(DateTime.now().add(const Duration(hours: 3)));

      provider.clearPendingOrder();

      expect(provider.scheduledAt, isNull);
      expect(provider.isScheduledBooking, isFalse);
    });
  });

  group('loadScheduledOrders', () {
    test('GET /orders/scheduled dan ro\'yxatni o\'qiydi', () async {
      when(() => apiClient.get(ApiEndpoints.scheduledOrders)).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.scheduledOrders, [
          _orderJson(id: 'order-1', scheduledAt: '2026-08-20T03:00:00.000Z'),
          _orderJson(id: 'order-2', scheduledAt: '2026-08-21T03:00:00.000Z'),
        ]),
      );

      await provider.loadScheduledOrders();

      expect(provider.scheduledOrders, hasLength(2));
      expect(ApiEndpoints.scheduledOrders, '/orders/scheduled');
    });

    test('xato bo\'lsa umumiy holatni buzmaydi', () async {
      when(() => apiClient.get(ApiEndpoints.scheduledOrders)).thenThrow(
        DioException(requestOptions: RequestOptions(path: ApiEndpoints.scheduledOrders)),
      );

      await provider.loadScheduledOrders();

      expect(provider.scheduledOrders, isEmpty);
      expect(provider.state, isNot(OrderProviderState.error));
    });
  });

  group('cancelScheduledOrder', () {
    test('mavjud cancel endpointidan foydalanadi va ro\'yxatdan o\'chiradi', () async {
      when(() => apiClient.get(ApiEndpoints.scheduledOrders)).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.scheduledOrders, [
          _orderJson(id: 'order-1', scheduledAt: '2026-08-20T03:00:00.000Z'),
          _orderJson(id: 'order-2', scheduledAt: '2026-08-21T03:00:00.000Z'),
        ]),
      );
      when(() => apiClient.patch(any(), data: any(named: 'data'))).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.cancelOrder('order-1'), _orderJson()),
      );

      await provider.loadScheduledOrders();
      final ok = await provider.cancelScheduledOrder('order-1');

      expect(ok, isTrue);
      verify(() => apiClient.patch('/orders/order-1/cancel', data: any(named: 'data')))
          .called(1);
      expect(provider.scheduledOrders.map((o) => o.id), ['order-2']);
    });

    test('xatoda ro\'yxat o\'zgarmaydi', () async {
      when(() => apiClient.get(ApiEndpoints.scheduledOrders)).thenAnswer(
        (_) async => _jsonResponse(ApiEndpoints.scheduledOrders, [
          _orderJson(id: 'order-1', scheduledAt: '2026-08-20T03:00:00.000Z'),
        ]),
      );
      when(() => apiClient.patch(any(), data: any(named: 'data'))).thenThrow(
        DioException(requestOptions: RequestOptions(path: '/orders/order-1/cancel')),
      );

      await provider.loadScheduledOrders();
      final ok = await provider.cancelScheduledOrder('order-1');

      expect(ok, isFalse);
      expect(provider.scheduledOrders, hasLength(1));
    });
  });
}
