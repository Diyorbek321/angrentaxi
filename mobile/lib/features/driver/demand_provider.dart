import 'dart:async';

import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/demand_zone.dart';
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

// ============================================================================
// TALAB XARITASI HOLATI — GET /surge/zones.
//
// Nega alohida provayder: `DriverProvider` butun smena davomida yashaydi
// (joylashuv oqimi, socket, buyurtma). Talab zonalari esa faqat bitta ekran
// ochiq turganda kerak — ma'lumotni ham, 60 soniyalik taymerni ham o'sha
// ekranning umriga bog'lash eng xavfsizi: ekran yopilsa, so'rovlar ham
// to'xtaydi.
// ============================================================================

enum DemandProviderState { idle, loading, success, error }

class DemandProvider extends ChangeNotifier {
  DemandProvider({
    required ApiClient apiClient,
    required LocationService locationService,
  })  : _apiClient = apiClient,
        _locationService = locationService;

  final ApiClient _apiClient;
  final LocationService _locationService;

  /// Yangilanish oralig'i. Surge backendda daqiqalik oynalarda hisoblanadi,
  /// shuning uchun bundan tez so'rash yangi ma'lumot bermaydi — faqat
  /// trafik va batareyani yeydi.
  static const Duration refreshInterval = Duration(seconds: 60);

  /// Markazdan nechta halqa zona so'raladi. 4 halqa ≈ shahar markazi +
  /// atrofi: haydovchi 5-10 daqiqada yetib boradigan masofa.
  static const int rings = 4;

  DemandProviderState _state = DemandProviderState.idle;
  String? _error;
  DemandZones _zones = DemandZones.empty;
  DateTime? _updatedAt;
  LatLng? _center;

  Timer? _timer;
  bool _disposed = false;

  /// Bir vaqtda faqat bitta so'rov: taymer va qo'lda bosilgan "yangilash"
  /// ustma-ust tushib qolsa, ikkinchisi kutmaydi — shunchaki o'tkazib
  /// yuboriladi.
  bool _inFlight = false;

  DemandProviderState get state => _state;
  String? get error => _error;
  DemandZones get zones => _zones;
  DateTime? get updatedAt => _updatedAt;

  /// Xarita kamerasining markazi — haydovchining oxirgi ma'lum joyi.
  LatLng? get center => _center;

  bool get hasData => _updatedAt != null;

  /// Avtomatik yangilash ishlayaptimi (ekran fon rejimida to'xtatiladi).
  bool get isAutoRefreshing => _timer != null;

  void _notify() {
    if (_disposed) return;
    notifyListeners();
  }

  /// Ekran ochilganda: birinchi yuklash + davriy yangilash.
  Future<void> start() async {
    await refresh();
    _startTimer();
  }

  void _startTimer() {
    if (_disposed) return;
    _timer?.cancel();
    _timer = Timer.periodic(refreshInterval, (_) => refresh(silent: true));
  }

  /// Ilova fonga o'tganda chaqiriladi — ko'rinmayotgan ekran uchun har
  /// daqiqada so'rov yuborish mantiqsiz.
  void pauseAutoRefresh() {
    _timer?.cancel();
    _timer = null;
  }

  /// Ilova qaytganda: darhol bir marta yangilaymiz (fon davrida ma'lumot
  /// eskirgan), keyin taymerni tiklaymiz.
  void resumeAutoRefresh() {
    if (_disposed || _timer != null) return;
    _startTimer();
    refresh(silent: true);
  }

  /// [silent] — ekranda allaqachon ma'lumot bo'lsa, yuklanish holatiga
  /// o'tmaydi. Aks holda har daqiqada xarita "yo'qolib" qayta chizilardi.
  Future<void> refresh({bool silent = false}) async {
    if (_inFlight) return;
    _inFlight = true;

    if (!silent || !hasData) {
      _state = DemandProviderState.loading;
      _error = null;
      _notify();
    }

    try {
      final center = await _resolveCenter();
      if (center == null) {
        _fail(
          "Joylashuvingiz aniqlanmadi. GPS yoqilganini va ilovaga ruxsat "
          "berilganini tekshiring.",
          silent: silent,
        );
        return;
      }

      final response = await _apiClient.get(
        ApiEndpoints.surgeZones,
        params: {
          'lat': center.latitude,
          'lng': center.longitude,
          'rings': rings,
        },
      );

      _zones = DemandZones.fromResponse(response.data);
      _updatedAt = DateTime.now();
      _error = null;
      _state = DemandProviderState.success;
      _notify();
    } catch (e) {
      _fail(extractErrorMessage(e), silent: silent);
    } finally {
      _inFlight = false;
    }
  }

  /// Xato ko'rsatish qoidasi: ekranda eski ma'lumot bo'lsa, uni o'chirmaymiz.
  /// Eskirgan zonalar ham bo'sh ekrandan foydaliroq — faqat xabar bilan
  /// ogohlantiramiz ("yangilanmadi"), holat `success` bo'lib qoladi.
  void _fail(String message, {required bool silent}) {
    _error = message;
    if (!(silent && hasData)) {
      _state = DemandProviderState.error;
    }
    _notify();
  }

  Future<LatLng?> _resolveCenter() async {
    final position = await _locationService.getCurrentPosition();
    if (position != null) {
      _center = LatLng(position.latitude, position.longitude);
      return _center;
    }
    // GPS bir marta ishlab, keyin uzilib qolsa — oxirgi ma'lum markaz
    // bilan davom etamiz. Zonalar bir necha yuz metrga siljishi mumkin,
    // lekin ekranni butunlay yo'qotgandan yaxshi.
    return _center;
  }

  @override
  void dispose() {
    _disposed = true;
    _timer?.cancel();
    _timer = null;
    super.dispose();
  }
}

DemandProvider buildDemandProvider() => DemandProvider(
      apiClient: sl<ApiClient>(),
      locationService: sl<LocationService>(),
    );
