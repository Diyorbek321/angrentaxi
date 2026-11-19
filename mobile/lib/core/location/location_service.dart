import 'dart:io' show Platform;

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

  /// [background] keeps updates flowing while the app is backgrounded (the
  /// driver switches to a navigation app while online). On iOS this needs the
  /// `location` UIBackgroundModes entry, which only the driver app declares,
  /// and shows the system blue location indicator while active.
  Stream<Position> getPositionStream({
    int distanceFilter = 10,
    bool background = false,
  }) {
    final LocationSettings settings;
    if (Platform.isIOS) {
      settings = AppleSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilter,
        activityType: ActivityType.automotiveNavigation,
        pauseLocationUpdatesAutomatically: !background,
        allowBackgroundLocationUpdates: background,
        showBackgroundLocationIndicator: background,
      );
    } else if (Platform.isAndroid && background) {
      settings = AndroidSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilter,
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: 'Angren Taxi Driver',
          notificationText: 'Siz onlaynsiz — buyurtmalar qabul qilinmoqda',
          enableWakeLock: true,
        ),
      );
    } else {
      settings = LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilter,
      );
    }
    return Geolocator.getPositionStream(locationSettings: settings);
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
