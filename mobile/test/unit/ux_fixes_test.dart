// UI tekshiruvidan chiqqan tuzatishlar (2026-10-10): safar uzunligi taklif
// paketida, oxirgi manzillar, narx formati bitta ko'rinishda.
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class _MockApiClient extends Mock implements ApiClient {}

Map<String, dynamic> _order(
  String id, {
  required String dropoff,
  String status = 'completed',
  bool metered = false,
  String serviceType = 'taxi',
}) =>
    {
      'id': id,
      'passengerId': 'p-1',
      'pickup': {'address': 'Uy', 'lat': 41.0, 'lng': 70.1},
      'dropoff': {'address': dropoff, 'lat': 41.01, 'lng': 70.11},
      'status': status,
      'estimatedPrice': 15000,
      'createdAt': '2026-10-10T10:00:00.000Z',
      'isMetered': metered,
      'serviceType': serviceType,
    };

void main() {
  group('Order — safar uzunligi', () {
    test('taklif paketidagi safar masofasi va vaqti o\'qiladi', () {
      final order = Order.fromJson({
        ..._order('o-1', dropoff: 'Bozor', status: 'searching'),
        'distanceKm': 1.3,
        'tripDistanceKm': 4.2,
        'tripDurationMin': 11,
      });
      expect(order.tripDistanceKm, 4.2);
      expect(order.tripDurationMin, 11);
      // `distanceKm` — boshqa narsa (olish nuqtasigacha), aralashmaydi.
      expect(order.distanceKm, 1.3);
    });

    test('eski paket (maydonsiz) — null, xato emas', () {
      final order = Order.fromJson(_order('o-1', dropoff: 'Bozor'));
      expect(order.tripDistanceKm, isNull);
      expect(order.tripDurationMin, isNull);
    });
  });

  group('OrderProvider.recentDestinations', () {
    late _MockApiClient api;
    late OrderProvider provider;

    setUp(() {
      api = _MockApiClient();
      provider = OrderProvider(apiClient: api, socketService: SocketService());
    });

    void stubHistory(List<Map<String, dynamic>> orders) {
      when(() => api.get(ApiEndpoints.orderHistory)).thenAnswer(
        (_) async => Response<dynamic>(
          requestOptions: RequestOptions(path: ApiEndpoints.orderHistory),
          statusCode: 200,
          data: {
            'success': true,
            'data': {'orders': orders},
          },
        ),
      );
    }

    test('tugagan safarlarning manzillari, takrorsiz, eng yangisi birinchi', () async {
      stubHistory([
        _order('1', dropoff: 'Bozor'),
        _order('2', dropoff: 'Ish joyi'),
        _order('3', dropoff: 'bozor '), // xuddi shu joy
        _order('4', dropoff: 'Kasalxona', status: 'cancelled'),
        _order('5', dropoff: 'Taksometr', metered: true),
        _order('6', dropoff: 'Restoran', serviceType: 'food'),
        _order('7', dropoff: 'Ota-onam'),
      ]);

      await provider.loadRecentDestinations();

      expect(
        provider.recentDestinations.map((d) => d.address),
        ['Bozor', 'Ish joyi', 'Ota-onam'],
      );
    });

    test('ko\'pi bilan 5 ta', () async {
      stubHistory([for (var i = 0; i < 9; i++) _order('$i', dropoff: 'Joy $i')]);
      await provider.loadRecentDestinations();
      expect(provider.recentDestinations, hasLength(OrderProvider.maxRecentDestinations));
    });

    test('yuklash xatosi umumiy holat va xatoga TEGMAYDI', () async {
      when(() => api.get(ApiEndpoints.orderHistory)).thenThrow(Exception('net'));

      await provider.loadRecentDestinations();

      expect(provider.error, isNull);
      expect(provider.state, OrderProviderState.idle);
      expect(provider.recentDestinations, isEmpty);
    });
  });

  test('narx bitta ko\'rinishda: "so\'m", UZS emas', () {
    // Standart til — o'zbekcha.
    expect(AppL10n.localeName, 'uz');
    // Guruhlash bo'linmas bo'sh joy bilan (intl) — raqam qatorga bo'linmaydi.
    expect(Formatters.formatPrice(18500), endsWith("so'm"));
    expect(Formatters.formatPrice(18500), isNot(contains('UZS')));
    expect(Formatters.formatPrice(18500), Formatters.formatSom(18500));
    expect(Formatters.formatPriceCompact(12000), "12 ming so'm");
  });
}
