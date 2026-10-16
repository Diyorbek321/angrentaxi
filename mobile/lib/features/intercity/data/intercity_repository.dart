import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/intercity/models/intercity_models.dart';

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

  Future<List<IntercityTrip>> searchTrips({
    required String routeId,
    required String date,
  }) async {
    final res = await _api.get(
      ApiEndpoints.intercityTrips,
      params: {'routeId': routeId, 'date': date},
    );
    return _list(_data(res.data)).map(IntercityTrip.fromJson).toList();
  }

  Future<IntercityTrip> trip(String id) async {
    final res = await _api.get(ApiEndpoints.intercityTrip(id));
    return IntercityTrip.fromJson(
        Map<String, dynamic>.from(_data(res.data) as Map));
  }

  Future<IntercityBooking> book({
    required String tripId,
    required String kind,
    int? seats,
    required IntercityPlace pickup,
    required IntercityPlace dropoff,
  }) async {
    final res = await _api.post(
      ApiEndpoints.intercityTripBookings(tripId),
      data: {
        'kind': kind,
        if (kind == IntercityBookingKind.seat) 'seats': seats ?? 1,
        'pickup': pickup.toJson(),
        'dropoff': dropoff.toJson(),
        'paymentMethod': 'cash',
      },
    );
    return IntercityBooking.fromJson(
        Map<String, dynamic>.from(_data(res.data) as Map));
  }

  Future<List<IntercityBooking>> myBookings() async {
    final res = await _api.get(ApiEndpoints.intercityMyBookings);
    return _list(_data(res.data)).map(IntercityBooking.fromJson).toList();
  }

  Future<IntercityBooking> cancelBooking(String orderId) async {
    final res = await _api.post(ApiEndpoints.intercityBookingCancel(orderId));
    return IntercityBooking.fromJson(
        Map<String, dynamic>.from(_data(res.data) as Map));
  }
}
