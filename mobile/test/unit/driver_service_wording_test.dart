// Xizmat turiga qarab matn tanlaydigan jadval uchun testlar.
//
// ⚠️ Bu testlarning asosiy maqsadi — NOMA'LUM TUR ILOVANI YIQITMASLIGINI
// qo'riqlash. Server kelajakda yangi vertikal qo'shsa (`pharmacy`,
// `laundry`), eski APK buyurtmani baribir ko'rsatishi va oqim ishlashda
// davom etishi kerak; eng yomon holatda taksi so'zlari ko'rinadi.
//
// Ikkinchi maqsad — matnlar EKRANLARGA SOCHILIB ketmasligi: har bir tur
// uchun to'liq to'plam shu yerda tekshiriladi, ekranlar esa faqat o'qiydi.
import 'package:angren_taxi/features/driver/service_wording.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Order _order({String? serviceType}) => Order.fromJson({
      'id': 'order-1',
      'passengerId': 'passenger-1',
      'pickup': const {'address': 'A', 'lat': 41.0, 'lng': 70.0},
      'dropoff': const {'address': 'B', 'lat': 41.1, 'lng': 70.1},
      'status': 'in_progress',
      'estimatedPrice': 20000.0,
      'createdAt': '2026-07-13T10:00:00.000Z',
      if (serviceType != null) 'serviceType': serviceType,
    });

void main() {
  group('Order.serviceType', () {
    test("maydon kelmasa `taxi` — eski buyurtmalar va realtime paketlari",
        () {
      expect(_order().serviceType, kServiceTypeTaxi);
    });

    test('registr va bo\'shliq normallashtiriladi', () {
      expect(_order(serviceType: '  FOOD ').serviceType, kServiceTypeFood);
    });

    test("noma'lum qiymat XOM holicha saqlanadi", () {
      // Enum bo'lganda bu yerda parse xatosi bo'lardi.
      expect(_order(serviceType: 'pharmacy').serviceType, 'pharmacy');
    });

    test('bo\'sh satr `taxi` ga tushadi', () {
      expect(_order(serviceType: '   ').serviceType, kServiceTypeTaxi);
    });

    test('tenglikda hisobga olinadi (props)', () {
      // Aks holda `copyWith(serviceType: ...)` natijasi eskisiga TENG deb
      // topilar va UI yangilanmasdi.
      expect(_order(serviceType: 'food') == _order(serviceType: 'taxi'),
          isFalse);
    });

    test('toJson `serviceType` ni saqlaydi', () {
      expect(_order(serviceType: 'market').toJson()['serviceType'],
          kServiceTypeMarket);
    });
  });

  group('DriverServiceWording.of', () {
    test('taksi — yo\'lovchi so\'zlari', () {
      final wording = DriverServiceWording.of(kServiceTypeTaxi);
      expect(wording.serviceType, kServiceTypeTaxi);
      expect(wording.typeLabel, 'Taksi');
      expect(wording.subject, "Yo'lovchi");
      expect(wording.clientLabel, "Yo'lovchi");
      expect(wording.pickupActionLabel, "Yo'lovchini oling");
      expect(wording.startActionLabel, 'Safarni boshlash');
      expect(wording.routeHeader, "Yo'lovchiga yo'l");
      expect(wording.icon, Icons.local_taxi);
    });

    test('cargo — yuk so\'zlari', () {
      final wording = DriverServiceWording.of(kServiceTypeCargo);
      expect(wording.serviceType, kServiceTypeCargo);
      expect(wording.subject, 'Yuk');
      expect(wording.pickupActionLabel, 'Yukni oling');
      expect(wording.startActionLabel, 'Yetkazishni boshlash');
      expect(wording.distanceToPickupLabel, 'Yukkacha');
    });

    test('food — olish nuqtasi RESTORAN', () {
      final wording = DriverServiceWording.of(kServiceTypeFood);
      expect(wording.serviceType, kServiceTypeFood);
      expect(wording.typeLabel, 'Ovqat yetkazish');
      expect(wording.subject, 'Restoran');
      expect(wording.pickupTitle, 'Restoran');
      expect(wording.pickupActionLabel, 'Buyurtmani oling');
      expect(wording.startActionLabel, 'Yetkazishni boshlash');
      expect(wording.routeHeader, "Restoranga yo'l");
      // Yetkazish tomonidagi odam yo'lovchi emas, MIJOZ.
      expect(wording.clientLabel, 'Mijoz');
    });

    test('market — olish nuqtasi DO\'KON', () {
      final wording = DriverServiceWording.of(kServiceTypeMarket);
      expect(wording.serviceType, kServiceTypeMarket);
      expect(wording.subject, "Do'kon");
      expect(wording.pickupTitle, "Do'kon");
      expect(wording.pickupActionLabel, 'Buyurtmani oling');
      expect(wording.routeHeader, "Do'konga yo'l");
    });

    test("noma'lum tur taksi matnlariga qaytadi — ilova yiqilmaydi", () {
      final wording = DriverServiceWording.of('pharmacy');
      expect(wording.serviceType, kServiceTypeTaxi);
      expect(wording.subject, "Yo'lovchi");
      expect(wording.startActionLabel, 'Safarni boshlash');
    });

    test('null va bo\'sh qiymat ham taksi', () {
      expect(DriverServiceWording.of(null).serviceType, kServiceTypeTaxi);
      expect(DriverServiceWording.of('').serviceType, kServiceTypeTaxi);
    });

    test('katta harfli qiymat tanib olinadi', () {
      expect(DriverServiceWording.of('FOOD').serviceType, kServiceTypeFood);
    });
  });

  group('DriverServiceWording.lookup', () {
    test("noma'lum tur uchun null — ikonka yolg'on ko'rsatmasin", () {
      expect(DriverServiceWording.lookup('pharmacy'), isNull);
    });

    test('maydonning YO\'Q bo\'lishi noma\'lum tur EMAS — bu taksi', () {
      // `null` "server aytmadi" degani, "server yangi tur aytdi" emas.
      expect(DriverServiceWording.lookup(null), DriverServiceWording.taxi);
      expect(DriverServiceWording.lookup(''), DriverServiceWording.taxi);
    });

    test('tanish turlar topiladi', () {
      expect(DriverServiceWording.lookup(kServiceTypeTaxi), isNotNull);
      expect(DriverServiceWording.lookup(kServiceTypeCargo), isNotNull);
      expect(DriverServiceWording.lookup(kServiceTypeFood), isNotNull);
      expect(DriverServiceWording.lookup(kServiceTypeMarket), isNotNull);
    });
  });

  group('Order.wording', () {
    test('buyurtmadan to\'g\'ridan-to\'g\'ri o\'qiladi', () {
      expect(_order(serviceType: 'food').wording.subject, 'Restoran');
      expect(_order().wording.subject, "Yo'lovchi");
      expect(_order(serviceType: 'pharmacy').wording.subject, "Yo'lovchi");
    });
  });
}
