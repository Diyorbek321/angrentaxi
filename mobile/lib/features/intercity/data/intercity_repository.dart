import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';
import 'package:angren_taxi/features/intercity/models/intercity_request_models.dart';

/// Bandlash uchun manzil — server `IntercityBookingPlaceDto`.
class IntercityPlace {
  const IntercityPlace({
    required this.lat,
    required this.lng,
    required this.address,
  });

  final double lat;
  final double lng;
  final String address;

  Map<String, dynamic> toJson() => {'lat': lat, 'lng': lng, 'address': address};
}

/// Shaharlararo API. Ekranlar shu sinfga bog'lanadi — testlarda soxtasi
/// beriladi, tarmoq tafsiloti (konvert `{success, data}`) shu yerda qoladi.
///
/// Xatolar `DioException` sifatida yuqoriga chiqadi: ekran kodlangan
/// xatoni (`ApiError.from`) o'zi o'qiydi, chunki 409 da ro'yxatni yangilash
/// kabi xulq ekranga tegishli.
class IntercityRepository {
  IntercityRepository({ApiClient? apiClient}) : _apiClient = apiClient;

  final ApiClient? _apiClient;

  ApiClient get _api => _apiClient ?? sl<ApiClient>();

  static dynamic _data(dynamic body) =>
      body is Map && body.containsKey('data') ? body['data'] : body;

  static List<Map<String, dynamic>> _list(dynamic data) {
    final raw = data is Map ? data['items'] : data;
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList(growable: false);
  }

  Future<List<IntercityRoute>> routes() async {
    final res = await _api.get(ApiEndpoints.intercityRoutes);
    return _list(_data(res.data)).map(IntercityRoute.fromJson).toList();
  }

  /// [pickup]/[dropoff] — ixtiyoriy yo'lovchi manzili: berilsa har qatnovga
  /// `fit` (sizning tomonga / boshqa tumanga / aylanma) qo'shiladi.
  Future<List<IntercityTrip>> searchTrips({
    required String routeId,
    required String date,
    IntercityPlace? pickup,
    IntercityPlace? dropoff,
  }) async {
    final res = await _api.get(
      ApiEndpoints.intercityTrips,
      params: {
        'routeId': routeId,
        'date': date,
        if (pickup != null) ...{'pickupLat': pickup.lat, 'pickupLng': pickup.lng},
        if (dropoff != null) ...{'dropoffLat': dropoff.lat, 'dropoffLng': dropoff.lng},
      },
    );
    return _list(_data(res.data)).map(IntercityTrip.fromJson).toList();
  }

  Future<IntercityTrip> trip(String id) async {
    final res = await _api.get(ApiEndpoints.intercityTrip(id));
    return IntercityTrip.fromJson(
        Map<String, dynamic>.from(_data(res.data) as Map));
  }

  /// Band va narx so'rovi uchun BIR XIL tana — server ikkalasida bir xil
  /// hisob qiladi, shuning uchun ko'rsatilgan narx band narxi bilan teng.
  static Map<String, dynamic> _bookingBody({
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) =>
      {
        'kind': kind,
        if (kind == IntercityBookingKind.seat) 'seats': seats ?? 1,
        'pickup': pickup.toJson(),
        'dropoff': dropoff.toJson(),
        'paymentMethod': 'cash',
      };

  Future<IntercityBooking> book({
    required String tripId,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) async {
    final res = await _api.post(
      ApiEndpoints.intercityTripBookings(tripId),
      data: _bookingBody(
          kind: kind, seats: seats, pickup: pickup, dropoff: dropoff),
    );
    return IntercityBooking.fromJson(
        Map<String, dynamic>.from(_data(res.data) as Map));
  }

  /// "Shahar ichiga davom" bilan narx — hech narsa band qilinmaydi.
  Future<IntercityQuote> quote({
    required String tripId,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) async {
    final res = await _api.post(
      ApiEndpoints.intercityTripQuote(tripId),
      data: _bookingBody(
          kind: kind, seats: seats, pickup: pickup, dropoff: dropoff),
    );
    return IntercityQuote.fromJson(
        Map<String, dynamic>.from(_data(res.data) as Map));
  }

  Future<List<IntercityBooking>> myBookings() async {
    final res = await _api.get(ApiEndpoints.intercityMyBookings);
    return _list(_data(res.data)).map(IntercityBooking.fromJson).toList();
  }

  // ------------------------------------------------- so'rovlar (yo'lovchi)

  /// So'rov va uning narxi uchun BIR XIL tana (band tanasidagi kabi).
  static Map<String, dynamic> _requestBody({
    required String routeId,
    required String tripClass,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
    required DateTime windowStart,
    required DateTime windowEnd,
    int bonus = 0,
  }) =>
      {
        'routeId': routeId,
        'tripClass': tripClass,
        ..._bookingBody(kind: kind, seats: seats, pickup: pickup, dropoff: dropoff),
        'windowStart': windowStart.toUtc().toIso8601String(),
        'windowEnd': windowEnd.toUtc().toIso8601String(),
        if (bonus > 0) 'bonus': bonus,
      };

  /// Saqlamasdan narx: qat'iy tarif + davom + oshirish.
  Future<IntercityRequestQuote> requestQuote({
    required String routeId,
    required String tripClass,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
    required DateTime windowStart,
    required DateTime windowEnd,
    int bonus = 0,
  }) async {
    final res = await _api.post(
      ApiEndpoints.intercityRequestQuote,
      data: _requestBody(
        routeId: routeId,
        tripClass: tripClass,
        kind: kind,
        seats: seats,
        pickup: pickup,
        dropoff: dropoff,
        windowStart: windowStart,
        windowEnd: windowEnd,
        bonus: bonus,
      ),
    );
    return IntercityRequestQuote.fromJson(Map<String, dynamic>.from(_data(res.data) as Map));
  }

  Future<IntercityRequest> createRequest({
    required String routeId,
    required String tripClass,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
    required DateTime windowStart,
    required DateTime windowEnd,
    int bonus = 0,
  }) async {
    final res = await _api.post(
      ApiEndpoints.intercityRequests,
      data: _requestBody(
        routeId: routeId,
        tripClass: tripClass,
        kind: kind,
        seats: seats,
        pickup: pickup,
        dropoff: dropoff,
        windowStart: windowStart,
        windowEnd: windowEnd,
        bonus: bonus,
      ),
    );
    return _request(res.data);
  }

  Future<List<IntercityRequest>> myRequests() async {
    final res = await _api.get(
      ApiEndpoints.intercityMyRequests,
      params: {'page': 1, 'limit': 30},
    );
    return _list(_data(res.data)).map(IntercityRequest.fromJson).toList(growable: false);
  }

  /// [bonus] — yangi JAMI qo'shimcha (avvalgisidan katta), farq emas.
  Future<IntercityRequest> raiseRequestBonus(String id, int bonus) async {
    final res = await _api.post(ApiEndpoints.intercityRequestBonus(id), data: {'bonus': bonus});
    return _request(res.data);
  }

  Future<IntercityRequest> cancelRequest(String id) async =>
      _request((await _api.post(ApiEndpoints.intercityRequestCancel(id))).data);

  static IntercityRequest _request(dynamic body) =>
      IntercityRequest.fromJson(Map<String, dynamic>.from(_data(body) as Map));

  // ------------------------------------------------- so'rovlar (haydovchi)

  /// Ochiq so'rovlar (eng erta oraliq birinchi). Comfort so'rovlar faqat
  /// Comfort'ga ruxsati bor haydovchiga keladi — filtr serverda.
  Future<List<IntercityRequest>> requestBoard({String? routeId}) async {
    final res = await _api.get(
      ApiEndpoints.intercityRequestBoard,
      params: {if (routeId != null) 'routeId': routeId},
    );
    return _list(_data(res.data)).map(IntercityRequest.fromJson).toList(growable: false);
  }

  /// [tripId] — mavjud qatnovga; aks holda [departureAt] bilan yangi qatnov
  /// (server oraliqdagi mos qatnovni o'zi ham topadi).
  Future<IntercityRequestAcceptance> acceptRequest(
    String id, {
    String? tripId,
    DateTime? departureAt,
  }) async {
    final res = await _api.post(
      ApiEndpoints.intercityRequestAccept(id),
      data: {
        if (tripId != null) 'tripId': tripId,
        if (departureAt != null) 'departureAt': departureAt.toUtc().toIso8601String(),
      },
    );
    return IntercityRequestAcceptance.fromJson(Map<String, dynamic>.from(_data(res.data) as Map));
  }

  // ---------------------------------------------------------------- haydovchi

  /// Ochiq sozlamalar (`/settings/public`) — e'lon oynasi uchun.
  Future<IntercityPublicSettings> publicSettings() async {
    final res = await _api.get(ApiEndpoints.settingsPublic);
    final data = _data(res.data);
    return data is Map
        ? IntercityPublicSettings.fromJson(Map<String, dynamic>.from(data))
        : IntercityPublicSettings.disabled;
  }

  /// Narx serverda yo'nalishdan nusxalanadi — bu yerda yuborilmaydi.
  /// Tumanlar bo'sh — "hamma tumanlar" (server shunday tushunadi).
  Future<IntercityTrip> publishTrip({
    required String routeId,
    required DateTime departureAt,
    int? seatsTotal,
    required String tripClass,
    List<String> originDistrictIds = const [],
    List<String> destinationDistrictIds = const [],
  }) async {
    final res = await _api.post(
      ApiEndpoints.intercityTrips,
      data: {
        'routeId': routeId,
        'departureAt': departureAt.toUtc().toIso8601String(),
        if (seatsTotal != null) 'seatsTotal': seatsTotal,
        'tripClass': tripClass,
        if (originDistrictIds.isNotEmpty) 'originZoneIds': originDistrictIds,
        if (destinationDistrictIds.isNotEmpty) 'destinationZoneIds': destinationDistrictIds,
      },
    );
    return _trip(res.data);
  }

  Future<List<IntercityTrip>> myTrips() async {
    final res = await _api.get(
      ApiEndpoints.intercityMyTrips,
      params: {'page': 1, 'limit': 50},
    );
    return _list(_data(res.data)).map(IntercityTrip.fromJson).toList();
  }

  Future<IntercityTrip> cancelTrip(String id, {required String reason}) async {
    final res = await _api.post(
      ApiEndpoints.intercityTripCancel(id),
      data: {'reason': reason},
    );
    return _trip(res.data);
  }

  Future<IntercityTrip> startBoarding(String id) async =>
      _trip((await _api.post(ApiEndpoints.intercityTripStartBoarding(id))).data);

  Future<IntercityTrip> depart(String id) async =>
      _trip((await _api.post(ApiEndpoints.intercityTripDepart(id))).data);

  /// O'z qatnovining bandlari (yig'ish ekrani). Koordinatalar bilan.
  Future<List<IntercityDriverBooking>> tripBookings(String tripId) async {
    final res = await _api.get(ApiEndpoints.intercityTripBookings(tripId));
    return _list(_data(res.data))
        .map(IntercityDriverBooking.fromJson)
        .toList(growable: false);
  }

  /// Bekatlar tartibi (kimni birinchi olish/tushirish). [fromLat]/[fromLng] —
  /// haydovchining hozirgi joyi (olish bosqichida birinchi oraliq vaqti uchun).
  Future<IntercityRoutePlan> routePlan(String tripId, {double? fromLat, double? fromLng}) async {
    final res = await _api.get(
      ApiEndpoints.intercityTripRoutePlan(tripId),
      params: {
        if (fromLat != null && fromLng != null) ...{'fromLat': fromLat, 'fromLng': fromLng},
      },
    );
    return IntercityRoutePlan.fromJson(Map<String, dynamic>.from(_data(res.data) as Map));
  }

  /// Yo'lovchi oldiga yetib keldim — mavjud buyurtma yo'li (`/orders/:id/arrived`).
  Future<void> markArrived(String orderId) async {
    await _api.patch(ApiEndpoints.arrivedAtPickup(orderId));
  }

  /// "Kelmadi": band bekor, joy qaytarilmaydi.
  Future<IntercityTrip> noShow(String orderId) async =>
      _trip((await _api.post(ApiEndpoints.intercityBookingNoShow(orderId))).data);

  /// Yo'lovchini tushirdim — mavjud `/orders/:id/complete`: komissiya,
  /// 1% ushlash va chek shu yerda yoziladi. ⚠️ `DriverProvider.completeTrip`
  /// EMAS: u shahar safarining holatini (faol buyurtma, kunlik daromad)
  /// o'zgartiradi va safardan keyingi ekranlarni ochadi.
  Future<void> completeBooking(String orderId) async {
    await _api.patch(ApiEndpoints.completeTrip(orderId), data: const {});
  }

  static IntercityTrip _trip(dynamic body) =>
      IntercityTrip.fromJson(Map<String, dynamic>.from(_data(body) as Map));

  Future<IntercityBooking> cancelBooking(String orderId) async {
    final res = await _api.post(ApiEndpoints.intercityBookingCancel(orderId));
    return IntercityBooking.fromJson(
        Map<String, dynamic>.from(_data(res.data) as Map));
  }
}
