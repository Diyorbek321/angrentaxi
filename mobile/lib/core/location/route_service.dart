import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/route_step.dart';
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

/// Fetches real driving-route geometry. Used to draw the actual road route on
/// the map (instead of a straight line between pickup/dropoff) and to get a
/// real distance/duration for price estimation, matching what the backend's
/// price calculator expects.
///
/// Goes through the backend (`GET /routing/route`), never to OSRM directly.
/// Ilgari har bir APK ichida OSRM manzili qotib qolardi — amalda ommaviy demo
/// server, chunki server almashtirish uchun hech kim ilovani qayta build
/// qilmaydi. Endi OSRM faqat server sozlamasi (`OSRM_URL`), ilova esa
/// backend javobini OSRM shaklida oladi (`distance`, `duration`,
/// `geometry`, `legs`), shuning uchun tahlil qiluvchi kod o'zgarmadi.
class RouteService {
  RouteService(this._api);

  final ApiClient _api;

  /// Returns null if the route can't be fetched (offline, OSRM down, no
  /// route found) — callers should fall back to a straight line.
  ///
  /// [waypoints], if given, are intermediate stops visited in order between
  /// [from] and [to] (matching the backend's `Order.waypoints`).
  Future<RouteResult?> getRoute(
    LatLng from,
    LatLng to, {
    List<LatLng> waypoints = const [],
  }) async {
    try {
      final routePoints = [from, ...waypoints, to];
      final coords =
          routePoints.map((p) => '${p.longitude},${p.latitude}').join(';');
      final response = await _api.get(
        ApiEndpoints.routingRoute,
        params: {'coords': coords},
      );

      final body = response.data;
      final route = body is Map<String, dynamic> ? body['data'] : null;
      if (route is! Map<String, dynamic>) return null;

      final geometry = route['geometry'] as Map<String, dynamic>;
      final coordinates = geometry['coordinates'] as List<dynamic>;
      if (coordinates.isEmpty) return null;

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
