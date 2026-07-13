import 'package:dio/dio.dart';
import 'package:latlong2/latlong.dart';

class RouteResult {
  const RouteResult({
    required this.points,
    required this.distanceKm,
    required this.durationMin,
  });

  final List<LatLng> points;
  final double distanceKm;
  final double durationMin;
}

/// Fetches real driving-route geometry from OSRM's free public routing
/// server (no API key). Used to draw the actual road route on the map
/// (instead of a straight line between pickup/dropoff) and to get a real
/// distance/duration for price estimation, matching what the backend's
/// price calculator expects.
class RouteService {
  RouteService({Dio? dio})
      : _dio = dio ??
            Dio(BaseOptions(
              baseUrl: 'https://router.project-osrm.org',
              connectTimeout: const Duration(seconds: 8),
              receiveTimeout: const Duration(seconds: 8),
            ));

  final Dio _dio;

  /// Returns null if the route can't be fetched (offline, OSRM down, no
  /// route found) — callers should fall back to a straight line.
  Future<RouteResult?> getRoute(LatLng from, LatLng to) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        '/route/v1/driving/${from.longitude},${from.latitude};'
        '${to.longitude},${to.latitude}',
        queryParameters: {
          'overview': 'full',
          'geometries': 'geojson',
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
      );
    } catch (_) {
      return null;
    }
  }
}
