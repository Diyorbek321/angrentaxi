import 'package:geolocator/geolocator.dart';

/// Why [LocationService.getCurrentPosition] returned null, so callers can
/// show the driver/passenger a specific, actionable message instead of
/// silently falling back to a hardcoded map center.
enum LocationUnavailableReason {
  serviceDisabled,
  permissionDenied,
  permissionDeniedForever,
  timeoutOrError,
}

class LocationService {
  Future<bool> requestPermission() async {
    final bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return false;
    }

    return true;
  }

  Future<Position?> getCurrentPosition() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;

    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
    } catch (_) {
      return null;
    }
  }

  /// Re-checks permission/service state to explain a null result from
  /// [getCurrentPosition] — call this only after that returns null.
  Future<LocationUnavailableReason> checkUnavailableReason() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      return LocationUnavailableReason.serviceDisabled;
    }
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.deniedForever) {
      return LocationUnavailableReason.permissionDeniedForever;
    }
    if (permission == LocationPermission.denied) {
      return LocationUnavailableReason.permissionDenied;
    }
    // Permission/service look fine — getCurrentPosition must have hit its
    // own timeout or a GPS fix failure.
    return LocationUnavailableReason.timeoutOrError;
  }

  Stream<Position> getPositionStream({int distanceFilter = 10}) {
    return Geolocator.getPositionStream(
      locationSettings: LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilter,
      ),
    );
  }

  double calculateDistance(
    double startLat,
    double startLng,
    double endLat,
    double endLng,
  ) {
    return Geolocator.distanceBetween(startLat, startLng, endLat, endLng);
  }
}
