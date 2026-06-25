/// Static canned data for offline demo mode.
///
/// All values mimic the JSON shapes the real backend returns, so the existing
/// model `fromJson` factories and providers consume them unchanged.
class DemoData {
  DemoData._();

  // Angren city coordinates (matches AppConfig defaults).
  static const double pickupLat = 40.1392;
  static const double pickupLng = 69.1225;
  static const double dropoffLat = 40.1521;
  static const double dropoffLng = 69.1418;
  static const double driverStartLat = 40.1331;
  static const double driverStartLng = 69.1170;

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
}
