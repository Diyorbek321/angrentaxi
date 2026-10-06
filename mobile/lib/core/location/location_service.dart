import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

/// Fon xizmati bildirishnomasining matni (foydalanuvchi tilida).
class BackgroundNotice {
  const BackgroundNotice({
    required this.title,
    required this.text,
    required this.channelName,
  });

  final String title;
  final String text;
  final String channelName;
}

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

  /// Joylashuv oqimi.
  ///
  /// [background] berilsa (faqat Android) oqim FOREGROUND SERVICE orqali
  /// ishlaydi: doimiy bildirishnoma ko'rinadi va ekran o'chganda yoki
  /// haydovchi boshqa ilovaga (Yandex Navigator) o'tganda ham joylashuv
  /// kelaveradi. Busiz Android fondagi ilovaga soatiga bir necha fiks
  /// beradi — taksometr yo'lni to'g'ri chiziq qilib kam hisoblar, yo'lovchi
  /// esa mashinani qotib qolgan holda ko'rardi.
  ///
  /// "Har doim" ruxsati (ACCESS_BACKGROUND_LOCATION) KERAK EMAS: xizmat
  /// ilova ochiq paytda boshlanadi, "foydalanilganda" ruxsati yetadi.
  Stream<Position> getPositionStream({
    int distanceFilter = 10,
    BackgroundNotice? background,
  }) {
    final LocationSettings settings =
        background != null && defaultTargetPlatform == TargetPlatform.android
            ? AndroidSettings(
                accuracy: LocationAccuracy.high,
                distanceFilter: distanceFilter,
                foregroundNotificationConfig: ForegroundNotificationConfig(
                  notificationTitle: background.title,
                  notificationText: background.text,
                  notificationChannelName: background.channelName,
                  // Ekran o'chganda CPU uxlab qolmasin — aks holda fiks
                  // kelsa ham socket'ga yuborilmaydi.
                  enableWakeLock: true,
                  // Haydovchi bildirishnomani tasodifan surib yubora olmasin.
                  setOngoing: true,
                ),
              )
            : LocationSettings(
                accuracy: LocationAccuracy.high,
                distanceFilter: distanceFilter,
              );
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
