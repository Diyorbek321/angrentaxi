import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/platform/system_share.dart';
import 'package:angren_taxi/features/safety/contact_relay_service.dart';
import 'package:angren_taxi/shared/models/courier_tracking.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

Response<dynamic> _ok(dynamic data) => Response<dynamic>(
      requestOptions: RequestOptions(path: '/'),
      data: {'success': true, 'data': data},
      statusCode: 200,
    );

Order _order(String status) => Order.fromJson({
      'id': 'o-1',
      'passengerId': 'p-1',
      'pickup': const {'address': 'A', 'lat': 41.0, 'lng': 70.1},
      'dropoff': const {'address': 'B', 'lat': 41.02, 'lng': 70.15},
      'status': status,
      'estimatedPrice': 18000,
      'createdAt': '2026-10-10T10:00:00.000Z',
    });

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('ContactRelayService (INCIDENT-POLICY §4)', () {
    late _MockApiClient api;
    setUp(() => api = _MockApiClient());

    test("qo'ng'iroq raqami serverdan", () async {
      when(() => api.post(ApiEndpoints.orderCall('o-1')))
          .thenAnswer((_) async => _ok({'phone': '+998901112233', 'calleeRole': 'driver'}));
      expect(await ContactRelayService(api).counterpartyPhone('o-1'), '+998901112233');
    });

    test('posilka qabul qiluvchisi: target=recipient bilan', () async {
      when(() => api.post(ApiEndpoints.orderCall('o-1'), data: {'target': 'recipient'}))
          .thenAnswer((_) async => _ok({'phone': '+998901112233', 'calleeRole': 'recipient'}));
      expect(await ContactRelayService(api).recipientPhone('o-1'), '+998901112233');
    });

    test("bo'sh raqam — xato", () async {
      when(() => api.post(ApiEndpoints.orderCall('o-1'))).thenAnswer((_) async => _ok({'phone': ''}));
      expect(() => ContactRelayService(api).counterpartyPhone('o-1'), throwsStateError);
    });

    test('ulashish havolasi API asosidan quriladi', () async {
      when(() => api.post(ApiEndpoints.orderShare('o-1')))
          .thenAnswer((_) async => _ok({'token': 'tok', 'path': '/share/tok'}));
      final uri = await ContactRelayService(api, apiBaseUrl: 'https://x.uz/api/v1/').shareLink('o-1');
      expect(uri.toString(), 'https://x.uz/api/v1/share/tok');
    });

    test("noto'g'ri yo'l — xato", () async {
      when(() => api.post(ApiEndpoints.orderShare('o-1'))).thenAnswer((_) async => _ok({'path': 'http://evil'}));
      expect(() => ContactRelayService(api, apiBaseUrl: 'https://x.uz').shareLink('o-1'), throwsStateError);
    });

    test('mijoz sarlavhasi call-relay', () {
      expect(kClientFeaturesHeader, 'X-Client-Features');
      expect(kClientFeatures.split(','), containsAll(<String>['call-relay', 'cancel-fee']));
    });
  });

  group("qo'ng'iroq oynasi", () {
    test('faqat qabul qilingandan safar tugaguncha', () {
      expect(_order('accepted').callRelayOpen, isTrue);
      expect(_order('arrived').callRelayOpen, isTrue);
      expect(_order('in_progress').callRelayOpen, isTrue);
      expect(_order('searching').callRelayOpen, isFalse);
      expect(_order('completed').callRelayOpen, isFalse);
      expect(_order('cancelled').callRelayOpen, isFalse);
    });

    test('kuryer kuzatuvi ham', () {
      final tracking = CourierTracking.fromJson(const {'orderId': 'r1', 'status': 'in_progress', 'driverName': 'Ali'});
      expect(tracking.callRelayOpen, isTrue);
      final done = CourierTracking.fromJson(const {'orderId': 'r1', 'status': 'completed', 'driverName': 'Ali'});
      expect(done.callRelayOpen, isFalse);
    });
  });

  group('SystemShare', () {
    test("kanal yo'q — buferga nusxalanadi", () async {
      String? copied;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') copied = (call.arguments as Map)['text'] as String?;
          return null;
        },
      );
      final shown = await const SystemShare(MethodChannel('test/none')).shareText('salom');
      expect(shown, isFalse);
      expect(copied, 'salom');
    });

    test('kanal bor — tizim oynasi', () async {
      const channel = MethodChannel('test/share');
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async => call.method == 'shareText');
      expect(await const SystemShare(channel).shareText('salom', title: 'T'), isTrue);
    });
  });
}
