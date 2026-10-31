import 'dart:async';

import 'package:angren_taxi/core/location/position_quality.dart';
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

    final Position first;
    try {
      first = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 10),
      );
    } catch (_) {
      return null;
    }
    if (first.accuracy <= PositionQuality.goodAccuracyMeters) return first;

    // Birinchi javob ko'pincha minora/Wi-Fi bo'yicha (yuzlab metr) — GPS
    // hali "qizimagan". Aniqrog'ini qisqa kutamiz; kelmasa borini qaytaramiz
    // (umuman yo'qdan yaxshi — chaqiruvchi xaritani shu yerga qaratadi).
    try {
      final second = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best,
        timeLimit: const Duration(seconds: 6),
      );
      return PositionQuality.better(first, second);
    } catch (_) {
      return first;
    }
  }

  /// Android 12+ / iOS 14+ da foydalanuvchi "taxminiy" joylashuvni
  /// tanlaganmi. Unda telefon ~1 km aniqlikdagi nuqta beradi va olish pini
  /// qo'shni mahallaga tushadi. Aniqlab bo'lmasa — `false` (ogohlantirish
  /// sababsiz chiqmasin).
  Future<bool> isApproximate() async {
    try {
      return await Geolocator.getLocationAccuracy() ==
          LocationAccuracyStatus.reduced;
    } catch (_) {
      return false;
    }
  }

  /// Aniq joylashuvni so'raydi: avval tizim oynasi (Android 12+ unda
  /// "aniq" ni tanlashni taklif qiladi), bo'lmasa ilova sozlamalari.
  /// Haydovchi tayyorlik tekshiruvidagi bilan bir xil yo'l.
  Future<void> requestPrecise() async {
    try {
      await Geolocator.requestPermission();
      if (await isApproximate()) await Geolocator.openAppSettings();
    } catch (_) {
      // Plagin xatosi — foydalanuvchi sozlamalardan o'zi yoqadi.
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
  /// haydovchi boshqa ilovaga o'tganda ham joylashuv kelaveradi. Busiz
  /// Android fondagi ilovaga soatiga bir necha fiks beradi.
  ///
  /// "Har doim" ruxsati (ACCESS_BACKGROUND_LOCATION) KERAK EMAS: xizmat
  /// ilova ochiq paytda boshlanadi, "foydalanilganda" ruxsati yetadi.
  ///
  /// ⚠️ NEGA O'Z MULTIPLEKSORIMIZ. geolocator_android BITTA umumiy oqim
  /// beradi: ikkinchi chaqiruv birinchisining oqimini qaytaradi va O'Z
  /// sozlamasini e'tiborsiz qoldiradi, oqim (va fon xizmati) esa OXIRGI
  /// tinglovchi ketgandagina yopiladi. Natijada haydovchi oflayn bo'lsa ham
  /// navigatsiya ekrani tinglab turgani uchun "siz onlaynsiz" bildirishnomasi
  /// qolardi; teskarisi — ekran oldin ochilgan bo'lsa, onlayn bo'lganda fon
  /// xizmati umuman yoqilmasdi. Shuning uchun manba oqimni shu yerda BITTA
  /// ushlaymiz va tinglovchilar to'plami o'zgarganda kerakli sozlama
  /// (fon xizmati kerakmi, eng kichik masofa filtri) bilan qayta ochamiz.
  Stream<Position> getPositionStream({
    int distanceFilter = 10,
    BackgroundNotice? background,
  }) {
    late final _StreamClient client;
    final controller = StreamController<Position>(
      onListen: () {
        _clients.add(client);
        _reconfigure();
      },
      onCancel: () {
        _clients.remove(client);
        _reconfigure();
        // Bitta obunali oqim — tinglovchi ketdi, demak u boshqa kerak emas.
        unawaited(client.controller.close());
      },
    );
    client = _StreamClient(distanceFilter, background, controller);
    return controller.stream;
  }

  final List<_StreamClient> _clients = [];
  StreamSubscription<Position>? _source;
  ({int distanceFilter, BackgroundNotice? background})? _sourceConfig;

  /// Oqimda oxirgi yetkazilgan fiks — tartibni tekshirish uchun.
  Position? _lastDelivered;

  /// Qayta sozlashlar ketma-ket bajariladi: eski manbani yopish asinxron va
  /// u tugamay yangisi ochilsa, plagin hali yopilmagan oqimni qaytarardi.
  Future<void> _reconfigureChain = Future<void>.value();

  void _reconfigure() {
    _reconfigureChain = _reconfigureChain.then((_) => _applyConfig());
  }

  Future<void> _applyConfig() async {
    if (_clients.isEmpty) {
      await _source?.cancel();
      _source = null;
      _sourceConfig = null;
      return;
    }

    final isAndroid = defaultTargetPlatform == TargetPlatform.android;
    BackgroundNotice? background;
    var minFilter = _clients.first.distanceFilter;
    for (final c in _clients) {
      if (c.distanceFilter < minFilter) minFilter = c.distanceFilter;
      background ??= isAndroid ? c.background : null;
    }

    final current = _sourceConfig;
    if (_source != null &&
        current != null &&
        current.distanceFilter == minFilter &&
        identical(current.background, background)) {
      return;
    }

    await _source?.cancel();
    _sourceConfig = (distanceFilter: minFilter, background: background);
    _source = Geolocator.getPositionStream(
      locationSettings: _settingsFor(minFilter, background),
    ).listen(
      (position) {
        // Noaniq va tartibdan chiqqan fikslar hech bir tinglovchiga bormaydi
        // (`PositionQuality` dagi izohga qarang).
        if (!PositionQuality.isUsable(position, previous: _lastDelivered)) {
          return;
        }
        _lastDelivered = position;
        for (final c in List.of(_clients)) {
          c.controller.add(position);
        }
      },
      onError: (Object error, StackTrace stack) {
        for (final c in List.of(_clients)) {
          c.controller.addError(error, stack);
        }
      },
    );
  }

  LocationSettings _settingsFor(int distanceFilter, BackgroundNotice? background) {
    if (background == null) {
      return LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: distanceFilter,
      );
    }
    return AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: distanceFilter,
      foregroundNotificationConfig: ForegroundNotificationConfig(
        notificationTitle: background.title,
        notificationText: background.text,
        notificationChannelName: background.channelName,
        // Ekran o'chganda CPU uxlab qolmasin — aks holda fiks kelsa ham
        // socket'ga yuborilmaydi.
        enableWakeLock: true,
        // Haydovchi bildirishnomani tasodifan surib yubora olmasin.
        setOngoing: true,
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

class _StreamClient {
  _StreamClient(this.distanceFilter, this.background, this.controller);

  final int distanceFilter;
  final BackgroundNotice? background;
  final StreamController<Position> controller;
}
