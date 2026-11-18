// Demo safarida saqlangan buyurtma holati socket hodisalari bilan birga
// yangilanadi. Ilgari faqat socket xabari ketardi: ilova `GET /orders/:id`
// bilan holatni tiklaganda eski "searching" ni olib, ekranni "Haydovchi
// izlanmoqda" ga qaytarardi va haydovchi kartochkasi ko'rinmasdi.
import 'package:angren_taxi/core/demo/demo_engine.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  setUp(() {
    if (!sl.isRegistered<SocketService>()) {
      sl.registerLazySingleton<SocketService>(() => SocketService());
    }
  });

  Map<String, dynamic> fetch(String id) =>
      DemoEngine.instance.handle('GET', '/orders/$id', null)['data'] as Map<String, dynamic>;

  testWidgets("accepted → arrived → in_progress holati GET /orders/:id da ham ko'rinadi", (tester) async {
    final created = DemoEngine.instance.handle('POST', '/orders', {
      'tariffId': 'tariff-econom',
      'pickup': {'address': 'A', 'lat': 41.0, 'lng': 70.1},
      'dropoff': {'address': 'B', 'lat': 41.01, 'lng': 70.09},
    })['data'] as Map<String, dynamic>;
    final id = created['id'] as String;

    await tester.pump(const Duration(seconds: 3));
    expect(fetch(id)['status'], 'accepted');
    expect(fetch(id)['driver'], isNotNull);

    await tester.pump(const Duration(seconds: 7));
    expect(fetch(id)['status'], 'arrived');

    await tester.pump(const Duration(seconds: 3));
    expect(fetch(id)['status'], 'in_progress');

    // Jadval oxirigacha — test tugaganda kutilayotgan taymer qolmasin.
    await tester.pump(const Duration(seconds: 30));
  });
}
