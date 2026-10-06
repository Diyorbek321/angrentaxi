import 'dart:async';

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
