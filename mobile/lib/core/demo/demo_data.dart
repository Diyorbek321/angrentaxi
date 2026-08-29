/// Static canned data for offline demo mode.
///
/// All values mimic the JSON shapes the real backend returns, so the existing
/// model `fromJson` factories and providers consume them unchanged.
class DemoData {
  DemoData._();

  // Angren city coordinates (matches AppConfig defaults).
  //
  // These were previously ~130 km off, in Tajikistan — the demo trip ran
  // through empty mountains. The relative offsets between the three points
  // are unchanged, so the demo route keeps its original shape.
  static const double pickupLat = 41.0212;
  static const double pickupLng = 70.0795;
  static const double dropoffLat = 41.0341;
  static const double dropoffLng = 70.0988;
  static const double driverStartLat = 41.0151;
  static const double driverStartLng = 70.0740;

  static const String pickupAddress = 'Angren shahar markazi';
  static const String dropoffAddress = 'Angren bozori';

  static String passengerUserId = 'demo-passenger';

  static Map<String, dynamic> passengerUser(String phone) => {
        'id': passengerUserId,
        'phone': phone,
        'name': "Demo Yo'lovchi",
        'avatarUrl': null,
        'rating': 4.9,
        'totalTrips': 37,
      };

  static Map<String, dynamic> driverUser(String phone) => {
        'id': 'demo-driver-user',
        'phone': phone,
        'name': 'Sardor Toshmatov',
        'avatarUrl': null,
        'rating': 4.95,
        'totalTrips': 1284,
      };

  /// The driver assigned to a passenger's order / the logged-in driver profile.
  static Map<String, dynamic> driver() => {
        'id': 'demo-driver',
        'phone': '+998901112233',
        'name': 'Sardor Toshmatov',
        'carModel': 'Chevrolet Cobalt',
        'carColor': 'Oq',
        'carNumber': '01 A 777 AA',
        'avatarUrl': null,
        'rating': 4.95,
        'totalTrips': 1284,
        'isOnline': true,
        'currentLat': driverStartLat,
        'currentLng': driverStartLng,
      };

  static List<Map<String, dynamic>> tariffs() => [
        {
          'id': 'tariff-econom',
          'name': 'Ekonom',
          'description': 'Arzon va tezkor',
          'baseFare': 5000,
          'perKmRate': 1800,
          'minFare': 8000,
          'iconName': 'economy',
          'isAvailable': true,
          'maxPassengers': 4,
        },
        {
          'id': 'tariff-komfort',
          'name': 'Komfort',
          'description': 'Yangi va qulay avtomobillar',
          'baseFare': 8000,
          'perKmRate': 2500,
          'minFare': 12000,
          'iconName': 'comfort',
          'isAvailable': true,
          'maxPassengers': 4,
        },
        {
          'id': 'tariff-biznes',
          'name': 'Biznes',
          'description': 'Premium darajadagi xizmat',
          'baseFare': 15000,
          'perKmRate': 4000,
          'minFare': 25000,
          'iconName': 'business',
          'isAvailable': true,
          'maxPassengers': 4,
        },
      ];

  /// A couple of completed trips for the history screens.
  static List<Map<String, dynamic>> orderHistory() => [
        {
          'id': 'demo-order-h1',
          'passengerId': passengerUserId,
          'pickup': {
            'address': pickupAddress,
            'lat': pickupLat,
            'lng': pickupLng,
          },
          'dropoff': {
            'address': dropoffAddress,
            'lat': dropoffLat,
            'lng': dropoffLng,
          },
          'status': 'completed',
          'estimatedPrice': 18500,
          'actualPrice': 18500,
          'createdAt': '2026-06-23T18:32:00.000Z',
          'completedAt': '2026-06-23T18:51:00.000Z',
          'driver': driver(),
          'tariffId': 'tariff-komfort',
          'distanceKm': 4.2,
          'durationMin': 14,
        },
        {
          'id': 'demo-order-h2',
          'passengerId': passengerUserId,
          'pickup': {
            'address': 'Navoiy ko\'chasi',
            'lat': 40.1410,
            'lng': 69.1280,
          },
          'dropoff': {
            'address': 'Yangi shahar',
            'lat': 40.1600,
            'lng': 69.1500,
          },
          'status': 'completed',
          'estimatedPrice': 12000,
          'actualPrice': 12000,
          'createdAt': '2026-06-22T09:10:00.000Z',
          'completedAt': '2026-06-22T09:28:00.000Z',
          'driver': driver(),
          'tariffId': 'tariff-econom',
          'distanceKm': 3.1,
          'durationMin': 12,
        },
      ];

  // ---------------------------------------------------------------------
  // Safar cheki — GET /orders/:id/receipt
  // ---------------------------------------------------------------------

  /// Chek javobi (`OrderReceiptDto`) — demo buyurtma xaritasidan yasaladi.
  ///
  /// NEGA UMUMAN KERAK: demo rejimda noma'lum yo'llar bo'sh `{}` bilan
  /// javob berardi, ya'ni chek ekrani 0 so'mlik, manzilsiz, tarkibsiz
  /// "hujjat" ko'rsatardi. Bo'sh chek — soxta ekran, va u demo ko'rsatuvda
  /// mahsulot buzuq ekanini bildiradi.
  static Map<String, dynamic> receipt(
    Map<String, dynamic> order, {
    double tipAmount = 0,
  }) {
    final id = (order['id'] as String?) ?? 'demo-order';
    final total =
        ((order['actualPrice'] ?? order['estimatedPrice']) as num?)?.toDouble() ??
            0;
    final distanceKm = (order['distanceKm'] as num?)?.toDouble() ?? 4.2;
    final durationMin = (order['durationMin'] as num?)?.toInt() ?? 14;
    final pickup = order['pickup'] as Map?;
    final dropoff = order['dropoff'] as Map?;
    final driverInfo = order['driver'] as Map?;

    return {
      'orderId': id,
      // Backend UUID ning birinchi bo'lagini oladi; demo id lari
      // "demo-order-h1" ko'rinishida, shuning uchun oxirgi bo'lak —
      // aks holda hamma cheklarda bir xil "DEMO" turardi.
      'orderNumber': id.split('-').last.toUpperCase(),
      'completedAt': order['completedAt'] ??
          DateTime.now().toUtc().toIso8601String(),
      'serviceType': order['serviceType'] ?? 'taxi',
      'pickupAddress': pickup?['address'] ?? pickupAddress,
      'dropoffAddress': dropoff?['address'] ?? dropoffAddress,
      'waypoints': const <Map<String, dynamic>>[],
      'tariffId': order['tariffId'] ?? 'tariff-komfort',
      'tariffName': 'Komfort',
      'distanceKm': distanceKm,
      'durationMin': durationMin,
      'fare': _fare(
        distanceKm: distanceKm,
        durationMin: durationMin,
        total: total,
      ),
      'surgeMultiplier': 1.0,
      'grossPrice': total,
      'discountAmount': 0,
      'promoCode': null,
      'tipAmount': tipAmount,
      'total': total,
      'paymentMethod': 'wallet',
      'paymentStatus': 'completed',
      'unpaidAmount': 0,
      'driver': driverInfo == null
          ? null
          : {
              // Demo haydovchi xaritasida bitta `name` maydoni bor; backend
              // esa ism/familiyani birlashtirib yuboradi — ikkala shakl ham
              // qo'llab-quvvatlanadi.
              'name': driverInfo['name'] ??
                  "${driverInfo['firstName'] ?? 'Haydovchi'} "
                      "${driverInfo['lastName'] ?? ''}"
                          .trim(),
              'carModel': driverInfo['carModel'],
              'carNumber': driverInfo['carNumber'],
            },
    };
  }

  /// Narx tarkibi.
  ///
  /// ⚠️ Backend invarianti demo'da ham buzilmaydi:
  ///   asos + masofa + vaqt + eng kam haq + koeffitsient + chegara == jami.
  /// Hisoblangan summa buyurtma narxidan farq qilsa, farq "eng kam haq"
  /// (kam bo'lsa) yoki "yuqori narx chegarasi" (ko'p bo'lsa) qatoriga
  /// yoziladi — soxta raqam qo'shilmaydi, qatorlar baribir jamiga qo'shiladi.
  static Map<String, dynamic> _fare({
    required double distanceKm,
    required int durationMin,
    required double total,
  }) {
    const baseFare = 8000.0;
    const pricePerKm = 2500.0;
    const pricePerMin = 300.0;

    final distanceFare = distanceKm * pricePerKm;
    final timeFare = durationMin * pricePerMin;
    final gap = total - (baseFare + distanceFare + timeFare);

    return {
      'baseFare': baseFare,
      'distanceKm': distanceKm,
      'pricePerKm': pricePerKm,
      'distanceFare': distanceFare,
      'durationMin': durationMin,
      'pricePerMin': pricePerMin,
      'timeFare': timeFare,
      'minPriceAdjustment': gap > 0 ? gap : 0.0,
      'surgeMultiplier': 1.0,
      'surgeFare': 0.0,
      'maxPriceCap': gap < 0 ? gap : 0.0,
      'total': total,
    };
  }
}
