// Regression test for a bug where the tariff-select screen never showed any
// tariffs: Tariff.fromJson parsed baseFare/perKmRate/minFare/description
// keys, but the real backend (GET /tariffs) sends
// basePrice/pricePerKm/minPrice/isActive with no description field at all.
// The mismatched `(json['baseFare'] as num)` cast threw on the missing key,
// and OrderProvider.loadTariffs()'s catch-all swallowed the error silently,
// leaving the tariff list permanently empty.
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('Tariff.fromJson', () {
    test('parses the real backend field names (basePrice/pricePerKm/minPrice/isActive)', () {
      final json = {
        'id': '89dbd551-0282-475c-8fea-b894ef78cd88',
        'name': 'Standard',
        'serviceType': 'taxi',
        'vehicleType': null,
        'basePrice': 3000,
        'pricePerKm': 1500,
        'pricePerMin': 200,
        'minPrice': 5000,
        'surgeMultiplier': 1,
        'maxPrice': null,
        'isActive': true,
        'createdAt': '2026-06-26T17:07:12.779Z',
      };

      final tariff = Tariff.fromJson(json);

      expect(tariff.id, '89dbd551-0282-475c-8fea-b894ef78cd88');
      expect(tariff.name, 'Standard');
      expect(tariff.baseFare, 3000.0);
      expect(tariff.perKmRate, 1500.0);
      expect(tariff.minFare, 5000.0);
      expect(tariff.isAvailable, true);
      expect(tariff.description, ''); // backend doesn't send one
    });

    test('does not throw when isActive is false', () {
      final json = {
        'id': 'x',
        'name': 'Business',
        'basePrice': 8000,
        'pricePerKm': 4000,
        'minPrice': 15000,
        'isActive': false,
      };

      final tariff = Tariff.fromJson(json);

      expect(tariff.isAvailable, false);
    });
  });

  group('Tariff.fromJson surgeMultiplier', () {
    test('defaults to 1.0 when surgeMultiplier is absent', () {
      final json = {
        'id': 'x',
        'name': 'Standard',
        'basePrice': 3000,
        'pricePerKm': 1500,
        'minPrice': 5000,
      };

      final tariff = Tariff.fromJson(json);

      expect(tariff.surgeMultiplier, 1.0);
    });

    test('parses a real surge value from the backend', () {
      final json = {
        'id': 'x',
        'name': 'Standard',
        'basePrice': 3000,
        'pricePerKm': 1500,
        'minPrice': 5000,
        'surgeMultiplier': 1.5,
      };

      final tariff = Tariff.fromJson(json);

      expect(tariff.surgeMultiplier, 1.5);
    });
  });
}
