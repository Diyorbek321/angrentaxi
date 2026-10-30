import 'package:angren_taxi/core/location/maneuver_phrases.dart';
import 'package:angren_taxi/core/location/navigation_engine.dart';
import 'package:angren_taxi/core/location/off_route_detector.dart';
import 'package:angren_taxi/core/location/route_progress.dart';
import 'package:angren_taxi/core/location/route_service.dart';
import 'package:angren_taxi/core/location/voice_guide.dart';
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

/// Pog'onali navigatsiya — marshrut, ko'rsatma, ovoz va qayta qurish BIR joyda.
///
/// Ilgari bularning hammasi `NavigationScreen` ichida edi va faqat yo'lovchini
/// OLISHGA borishda ishlardi; yo'lovchi bilan safarda haydovchi ilovadan
/// tashqariga (Yandex Navigator) chiqishga majbur edi. Endi ikkala ekran ham
/// shu klassni ishlatadi, ya'ni ovoz, chetga chiqish va qayta qurish ikki
/// joyda bir xil ishlaydi.
///
/// Ekran faqat GPS ping'larini [onPosition] ga beradi va [routePoints] /
/// [progress] ni chizadi.
class TurnByTurnGuidance extends ChangeNotifier {
  TurnByTurnGuidance({
    required RouteService routes,
    required VoiceGuide voice,
    DateTime Function()? clock,
  })  : _routes = routes,
        _voice = voice,
        _clock = clock ?? DateTime.now;

  final RouteService _routes;
  final VoiceGuide _voice;
  final DateTime Function() _clock;

  LatLng? _destination;
  List<LatLng> _waypoints = const [];
  NavigationEngine? _engine;
  OffRouteDetector? _offRoute;
  NavigationProgress? _progress;
  List<LatLng> _routePoints = const [];
  RouteProgress? _line;
  double _routeDurationMin = 0;
  double? _remainingMeters;

  /// GPS shuncha yaqin bo'lsa mashina yo'lda deb hisoblanadi va chiziq
  /// uning ortidan qisqartiriladi. Uzoqroqda (chetga chiqqan, GPS adashgan)
  /// to'liq chiziq qoladi — qayerga qaytishni ko'rsatadi.
  static const double onRouteMeters = 40;
  bool _rerouting = false;
  bool _disposed = false;

  /// Oxirgi marshrut so'rovi vaqti — qayta urinishlarni siyraklash uchun.
  DateTime? _lastLoadAt;

  /// Marshrut kelmagan bo'lsa (OSRM xatosi, tarmoq) shuncha vaqtda bir
  /// qayta so'raladi. Ilgari birinchi urinish yiqilsa navigatsiya butun
  /// safar marshrutsiz qolardi.
  static const Duration routeRetryInterval = Duration(seconds: 15);

  /// Xaritadagi marshrut chizig'i (yuklanmaguncha bo'sh). Mashina yo'lda
  /// bo'lsa — faqat OLDINDAGI qismi.
  List<LatLng> get routePoints => _routePoints;

  /// Manzilgacha YO'L bo'yicha qolgan masofa (metr). Marshrut yo'q yoki
  /// birinchi ping'gacha — `null`.
  double? get remainingMeters => _remainingMeters;

  /// Manzilgacha taxminiy vaqt — marshrut davomiyligining qolgan ulushi.
  int? get remainingMinutes {
    final left = _remainingMeters;
    final total = _line?.totalMeters ?? 0;
    if (left == null || total <= 0) return null;
    return (_routeDurationMin * left / total).ceil();
  }

  /// Oxirgi ping'dagi holat — banner uchun. Birinchi ping'gacha `null`.
  NavigationProgress? get progress => _progress;

  /// OSRM manevrlar bergan va dvigatel ishlayapti.
  bool get hasRoute => _engine?.hasRoute ?? false;

  /// Marshrutni yuklaydi va ovozni tayyorlaydi. Har qismi yiqilsa ham ekran
  /// ishlayveradi: marshrut kelmasa banner yo'q, ovoz bo'lmasa banner qoladi.
  Future<void> start(LatLng from, LatLng to, {List<LatLng> waypoints = const []}) async {
    _destination = to;
    _waypoints = waypoints;
    await _load(from);
    // Ovoz marshrutdan KEYIN: birinchi ko'rsatma marshrutsiz aytilmaydi,
    // TTS tillarini so'rash esa sekin.
    await _voice.init();
  }

  /// Yangi marshrut bilan dvigatel va detektor NOLDAN boshlanadi: eski
  /// burilishlar haqida gapirmasin, eski chiziq bilan solishtirmasin.
  Future<void> _load(LatLng from) async {
    final to = _destination;
    if (to == null) return;
    _lastLoadAt = _clock();
    final route = await _routes.getRoute(from, to, waypoints: _waypoints);
    if (_disposed || route == null) return;
    _routePoints = route.points;
    _line = RouteProgress(route.points);
    _routeDurationMin = route.durationMin;
    _remainingMeters = null;
    _engine = NavigationEngine(steps: route.steps);
    _offRoute = OffRouteDetector(route.points);
    _notify();
  }

  /// Bekatga shuncha yaqin kelindi — u "o'tilgan".
  static const double waypointReachedMeters = 60;

  /// Hali boriladigan bekatlar (o'tilganlari olib tashlanadi).
  List<LatLng> get remainingWaypoints => _waypoints;

  /// Bitta GPS ping'i.
  void onPosition(LatLng here) {
    if (_disposed) return;
    final engine = _engine;
    if (engine == null) {
      _retryLoad(here);
      return;
    }

    // Navbatdagi bekatga yetildi — qayta qurishda u endi kiritilmaydi.
    if (_waypoints.isNotEmpty &&
        const Distance().as(LengthUnit.Meter, here, _waypoints.first) <= waypointReachedMeters) {
      _waypoints = _waypoints.sublist(1);
    }

    _progress = engine.update(here);

    final line = _line;
    if (line != null) {
      final projection = line.project(here);
      _remainingMeters = projection.remainingMeters;
      if (projection.offRouteMeters <= onRouteMeters) {
        _routePoints = line.remainingPoints(projection);
      }
    }

    // Chetga chiqildi (bir necha ping tasdiqlagan) — yo'l joriy joydan
    // qayta quriladi. Javob kelguncha eski ko'rsatma ekranda qoladi.
    if (_offRoute?.update(here, _clock()) ?? false) {
      _reroute(here);
    }

    // Dvigatel `announcement` ni FAQAT yangi (manevr, bosqich) juftligida
    // qaytaradi — gap takrorlanmaydi.
    final announcement = _progress!.announcement;
    if (announcement != null) {
      _voice.speak(announcement.text, clips: announcement.clips);
    }
    _notify();
  }

  /// Marshrut hali yo'q — joriy joydan jimgina qayta so'raladi ("qayta
  /// quryapman" degan ovozsiz: haydovchi hech qayerdan chetga chiqmagan).
  Future<void> _retryLoad(LatLng here) async {
    final last = _lastLoadAt;
    if (_rerouting || _destination == null) return;
    if (last != null && _clock().difference(last) < routeRetryInterval) return;
    _rerouting = true;
    try {
      await _load(here);
    } finally {
      _rerouting = false;
    }
  }

  Future<void> _reroute(LatLng here) async {
    if (_rerouting) return;
    _rerouting = true;
    _voice.speak(ManeuverPhrases.rerouting, clips: ManeuverPhrases.reroutingClips);
    try {
      // Faqat HALI O'TILMAGAN bekatlar orqali — aks holda yangi yo'l
      // haydovchini o'tib ketgan bekatga qaytarardi.
      await _load(here);
    } finally {
      _rerouting = false;
    }
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    // Ekran yopilganda gap o'rtasida qolgan ovoz to'xtatiladi.
    _voice.stop();
    super.dispose();
  }
}
