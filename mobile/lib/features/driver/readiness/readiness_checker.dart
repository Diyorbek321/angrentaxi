import 'package:angren_taxi/core/platform/driver_overlay.dart';
import 'package:angren_taxi/features/driver/readiness/driver_readiness.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart' as ph;
import 'package:shared_preferences/shared_preferences.dart';

/// Tayyorlik shartlarini o'qiydi va tuzatishga yordam beradi.
///
/// Interfeys — testlarda soxtasi beriladi (plaginlar `flutter test` da
/// ishlamaydi).
abstract class ReadinessChecker {
  Future<DriverReadiness> check();

  /// Foydalanuvchini shu shartni bajarishga olib boradi: tizim dialogi,
  /// u bo'lmasa — sozlamalar. Natija keyingi [check] da ko'rinadi.
  Future<void> fix(ReadinessItem item);
}

class PlatformReadinessChecker implements ReadinessChecker {
  const PlatformReadinessChecker([this._overlay = const DriverOverlay()]);

  final DriverOverlay _overlay;

  /// Haydovchi autostart sahifasini ochib qaytganmi (holatini telefon
  /// aytmaydigan OEM'lar uchun — [autostartOk]).
  static const String autostartVisitedKey = 'driver_autostart_visited';

  static Future<bool> _autostartVisited() async {
    try {
      return (await SharedPreferences.getInstance()).getBool(autostartVisitedKey) ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<void> _markAutostartVisited() async {
    try {
      await (await SharedPreferences.getInstance()).setBool(autostartVisitedKey, true);
    } catch (_) {
      // Saqlanmasa — keyingi sessiyada band yana tavsiya qilinadi, xolos.
    }
  }

  static bool _granted(LocationPermission p) =>
      p == LocationPermission.whileInUse || p == LocationPermission.always;

  @override
  Future<DriverReadiness> check() async {
    final gps = await Geolocator.isLocationServiceEnabled();
    final permission = await Geolocator.checkPermission();
    final location = _granted(permission);
    // Android 12+: foydalanuvchi "taxminiy" ni tanlashi mumkin — ruxsat
    // bor, lekin aniqlik ~1 km. Taksometr va geofence uchun yaroqsiz.
    final precise = location &&
        await Geolocator.getLocationAccuracy() == LocationAccuracyStatus.precise;
    // Android 12 va pastda bildirishnoma ruxsati yo'q — plagin "granted"
    // qaytaradi, ya'ni bu shart o'z-o'zidan bajarilgan.
    final notifications = await ph.Permission.notification.isGranted;
    // Faqat O'QILADI: so'rash uchun REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
    // kerak, uni Google Play alohida tekshiradi. Sozlamalar sahifasi yetarli.
    final battery = await ph.Permission.ignoreBatteryOptimizations.isGranted;
    final autostart = AutostartStatus.parse(await _overlay.autostartStatus());

    return DriverReadiness(
      {
        ReadinessItem.gps: gps,
        ReadinessItem.location: location,
        ReadinessItem.preciseLocation: precise,
        ReadinessItem.notifications: notifications,
        // Umumiy ruxsat yo'q bo'lsa kanal ham ishlamaydi — ikkinchi qizil
        // qator emas, avval yuqoridagini tuzatish kerak (canFix).
        ReadinessItem.offerAlerts: notifications && await _overlay.offerAlertsEnabled(),
        ReadinessItem.fullScreen: await _overlay.canUseFullScreenIntent(),
        ReadinessItem.overlay: await _overlay.canDrawOverlays(),
        ReadinessItem.autostart: autostartOk(autostart, visited: await _autostartVisited()),
        ReadinessItem.battery: battery,
      },
      xiaomiFamily: await _overlay.isXiaomiFamily(),
      hidden: {
        if (autostart == AutostartStatus.notApplicable) ReadinessItem.autostart,
      },
      autostartUnverifiable: autostart == AutostartStatus.unknown,
    );
  }

  @override
  Future<void> fix(ReadinessItem item) async {
    switch (item) {
      case ReadinessItem.gps:
        await Geolocator.openLocationSettings();
      case ReadinessItem.location:
        // "Boshqa so'ralmasin" bosilgan bo'lsa tizim dialogi chiqmaydi —
        // yagona yo'l ilova sozlamalari.
        if (await Geolocator.checkPermission() == LocationPermission.deniedForever) {
          await Geolocator.openAppSettings();
        } else {
          await Geolocator.requestPermission();
        }
      case ReadinessItem.preciseLocation:
        // Android 12+: qayta so'rov "taxminiy → aniq" dialogini ko'rsatadi.
        // Rad etilsa — sozlamalar ("Aniq joylashuvdan foydalanish").
        await Geolocator.requestPermission();
        if (await Geolocator.getLocationAccuracy() != LocationAccuracyStatus.precise) {
          await Geolocator.openAppSettings();
        }
      case ReadinessItem.notifications:
        final status = await ph.Permission.notification.request();
        if (status.isPermanentlyDenied) await ph.openAppSettings();
      case ReadinessItem.offerAlerts:
        await _overlay.openOfferAlertSettings();
      case ReadinessItem.fullScreen:
        await _overlay.openFullScreenIntentSettings();
      case ReadinessItem.overlay:
        // Tizim dialogi yo'q — faqat maxsus sozlamalar sahifasi.
        await _overlay.openOverlaySettings();
      case ReadinessItem.autostart:
        await _overlay.openAutostartSettings();
        await _markAutostartVisited();
      case ReadinessItem.battery:
        await ph.openAppSettings();
    }
  }
}
