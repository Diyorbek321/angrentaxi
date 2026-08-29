import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/shared/models/route_step.dart';
import 'package:dio/dio.dart';
import 'package:latlong2/latlong.dart';

class RouteResult {
  const RouteResult({
    required this.points,
    required this.distanceKm,
    required this.durationMin,
    this.steps = const [],
  });

  final List<LatLng> points;
  final double distanceKm;
  final double durationMin;

  /// Pog'onali (turn-by-turn) manevrlar — `legs[].steps[]` dan yig'ilgan.
  ///
  /// Yo'lovchi tomonidagi narx/marshrut chizig'i uchun kerak emas,
  /// shuning uchun standart qiymati bo'sh: OSRM `steps` ni qaytarmasa ham
  /// (eski server, boshqa profil) qolgan hamma narsa ishlayveradi.
  final List<RouteStep> steps;
}

/// Fetches real driving-route geometry from OSRM. Used to draw the actual road
/// route on the map (instead of a straight line between pickup/dropoff) and to
/// get a real distance/duration for price estimation, matching what the
/// backend's price calculator expects.
///
/// The endpoint comes from [AppConfig.osrmUrl] so builds can point at the
/// platform's own OSRM server. It defaults to OSRM's public demo server, which
/// is rate-limited and has no SLA — fine for a dev build, not for real traffic.
class RouteService {
  RouteService({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.osrmUrl,
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 8),
            ));

  final Dio _dio;

  /// Returns null if the route can't be fetched (offline, OSRM down, no
  /// route found) — callers should fall back to a straight line.
  ///
  /// [waypoints], if given, are intermediate stops visited in order between
  /// [from] and [to] (matching the backend's `Order.waypoints`), threaded
  /// into OSRM's multi-point `/route/v1/driving/{lon1},{lat1};{lon2},{lat2};...`
  /// URL syntax.
  ///
  /// `steps=true` HAR DOIM so'raladi: OSRM manevr ma'lumotini faqat shu
  /// bayroq bilan qaytaradi va u javob hajmini sezilarli oshirmaydi
  /// (bir marshrut uchun o'nlab qadam). Buning evaziga haydovchi
  /// navigatsiyasi tashqi ilovaga bog'lanmay, ilova ichida pog'onali
  /// ko'rsatma bera oladi.
  Future<RouteResult?> getRoute(
    LatLng from,
    LatLng to, {
    List<LatLng> waypoints = const [],
  }) async {
    try {
      final routePoints = [from, ...waypoints, to];
      final coordinateString =
          routePoints.map((p) => '${p.longitude},${p.latitude}').join(';');
      final response = await _dio.get<Map<String, dynamic>>(
        '/route/v1/driving/$coordinateString',
        queryParameters: {
          'overview': 'full',
          'geometries': 'geojson',
          'steps': 'true',
        },
      );

      final data = response.data;
      final routes = data?['routes'] as List<dynamic>?;
      if (routes == null || routes.isEmpty) return null;

      final route = routes.first as Map<String, dynamic>;
      final geometry = route['geometry'] as Map<String, dynamic>;
      final coordinates = geometry['coordinates'] as List<dynamic>;

      final points = coordinates
          .map((c) => c as List<dynamic>)
          .map((c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()))
          .toList();

      final distanceMeters = (route['distance'] as num).toDouble();
      final durationSeconds = (route['duration'] as num).toDouble();

      return RouteResult(
        points: points,
        distanceKm: distanceMeters / 1000,
        durationMin: durationSeconds / 60,
        steps: RouteStep.fromOsrmLegs(route['legs'] as List<dynamic>?),
      );
    } catch (_) {
      return null;
    }
  }
}
