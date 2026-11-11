// Demo rejimdagi narx bahosi — haqiqiy `POST /orders/calculate-price` shaklida.
//
// NEGA KERAK: ilova endpoint'i `/orders/calculate-price` ga, javob maydoni
// `price` ga o'zgargan, demo esa eski `/orders/estimate` + `estimatedPrice`
// da qolib ketgan edi — demo ilovada (va do'kon skrinshotlarida) tanlangan
// tarif narxi doim "0 so'm" chiqardi.
import 'package:angren_taxi/core/demo/demo_data.dart';
import 'package:angren_taxi/core/demo/demo_engine.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/driver_earnings_breakdown.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test("demo narx bahosi ilova o'qiydigan yo'l va maydonda, tarifga qarab", () {
    final tariffs = DemoData.tariffs();
    final prices = <double>[];
    for (final tariff in tariffs) {
      final body = DemoEngine.instance.handle('POST', ApiEndpoints.estimatePrice, {
        'tariffId': tariff['id'],
        'pickupLat': 41.0167,
        'pickupLng': 70.1436,
        'dropoffLat': 41.0102,
        'dropoffLng': 70.0861,
      });
      final payload = body['data'] as Map<String, dynamic>;
      final price = (payload['price'] as num).toDouble();
      expect(price, greaterThanOrEqualTo((tariff['minPrice'] as num).toDouble()));
      expect(payload['tariffId'], tariff['id']);
      expect(payload['distanceKm'], isA<num>());
      prices.add(price);
    }
    // Qimmatroq tarif — qimmatroq narx.
    expect(prices, orderedEquals([...prices]..sort()));
  });

  test("demo buyurtma narxi ko'rsatilgan baho bilan bir xil", () {
    final engine = DemoEngine.instance;
    final estimate = engine.handle('POST', ApiEndpoints.estimatePrice, {'tariffId': 'tariff-komfort'});
    final price = ((estimate['data'] as Map)['price'] as num).toDouble();
    final created = engine.handle('POST', '/orders', {
      'tariffId': 'tariff-komfort',
      'pickup': {'address': 'A', 'lat': 41.0, 'lng': 70.1},
      'dropoff': {'address': 'B', 'lat': 41.01, 'lng': 70.09},
    });
    expect(((created['data'] as Map)['estimatedPrice'] as num).toDouble(), price);
  });

  test("demo daromad ilova so'raydigan yo'llarda va modelga o'qiladi", () {
    final engine = DemoEngine.instance;
    final breakdown = DriverEarningsBreakdown.fromJson(
      engine.handle('GET', ApiEndpoints.driverEarningsBreakdown, null)['data'] as Map<String, dynamic>,
    );
    expect(breakdown.today.trips, greaterThan(0));
    expect(breakdown.today.net, breakdown.today.gross - breakdown.today.commission - breakdown.today.taxWithheld);
    expect(breakdown.month.gross, greaterThan(breakdown.week.gross));
    final headline = engine.handle('GET', ApiEndpoints.driverEarnings, null)['data'] as Map<String, dynamic>;
    expect((headline['today'] as num) > 0, isTrue);
  });
}
