import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/city_coverage.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/shared/models/driver.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/service_city.dart';
import 'package:angren_taxi/shared/models/tariff.dart';
import 'package:dio/dio.dart' show DioException;
import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

enum OrderProviderState { idle, loading, success, error }

class OrderProvider extends ChangeNotifier {
  OrderProvider({
    required ApiClient apiClient,
    required SocketService socketService,
  })  : _apiClient = apiClient,
        _socketService = socketService;

  final ApiClient _apiClient;
  final SocketService _socketService;

  OrderProviderState _state = OrderProviderState.idle;
  String? _error;
  Order? _activeOrder;
  List<Order> _orderHistory = [];
  List<Tariff> _tariffs = [];
  LatLng? _driverLocation;

  // Pending order creation data
  OrderLocation? _pendingPickup;
  OrderLocation? _pendingDropoff;
  final List<OrderLocation> _pendingWaypoints = [];
  Tariff? _selectedTariff;
  double? _estimatedPrice;

  /// Live surge for the pickup zone, as returned with the last quote. 1.0
  /// means normal pricing; anything above it is worth telling the passenger
  /// about, since an unexplained higher price reads as arbitrary.
  double _surgeMultiplier = 1.0;

  /// Tanlangan rejalashtirish vaqti (MAHALLIY vaqt). `null` = "hozir".
  ///
  /// Bu buyurtma qurilayotgan paytdagi TANLOV, saqlangan buyurtma emas —
  /// shuning uchun [_scheduledOrders] dan alohida turadi.
  DateTime? _scheduledAt;

  /// Serverdagi kelgusi rejalar (`GET /orders/scheduled`).
  List<Order> _scheduledOrders = [];

  /// Max intermediate stops allowed on a multi-stop ride, matching the
  /// backend's `WaypointDto` (`@ArrayMaxSize(5)`).
  static const int maxWaypoints = 5;

  /// Ilova bilgan xizmat hududlari. Boshlanishi — MA'LUMOT YO'Q holati,
  /// ya'ni hech qanday cheklov yo'q.
  CityCoverage _coverage = CityCoverage.empty;

  /// `GET /cities` hozir uchayaptimi — bosh ekran va tarif ekrani ikkalasi
  /// ham [loadCities] ni chaqiradi, ikki marta so'ramaslik uchun.
  Future<void>? _citiesInFlight;

  // Active super-app vertical: 'taxi' or 'cargo'. Drives which tariffs load
  // and which serviceType the order is created with.
  String _serviceType = 'taxi';
  Map<String, dynamic>? _cargoDetails;

  // Pending rating after trip completion
  String? pendingRatingOrderId;
  String? pendingRatingDriverName;

  // Set when matching.service.ts's handleNoDriversFound auto-cancels the
  // order — a one-off banner to show, consumed the same way as
  // pendingRatingOrderId above.
  String? noDriversFoundMessage;

  // ---- Chaqim (tips) holati ----
  //
  // ⚠️ NEGA umumiy [_state]/[_error] EMAS: baholash ekrani asosiy ekran
  // USTIDA modal sifatida ochiladi, va home_screen.dart dagi asosiy CTA
  // `state == loading` ga qarab aylanadi. Umumiy holatni ishlatsak,
  // chaqim yuborilayotganda orqadagi ekran ham "yuklanmoqda"ga o'tib
  // ketardi. Xuddi shu sabab bilan driver_provider.dart dagi
  // `requestWithdrawal` ham o'z bayroqlaridan foydalanadi.
  bool _isSubmittingTip = false;
  String? _tipError;

  /// Server 409 qaytardi — bu safar uchun chaqim allaqachon yozilgan.
  /// Qayta urinish foydasiz, shuning uchun UI tanlovni butunlay yopadi.
  bool _tipAlreadyGiven = false;

  OrderProviderState get state => _state;
  String? get error => _error;
  Order? get activeOrder => _activeOrder;
  List<Order> get orderHistory => List.unmodifiable(_orderHistory);
  List<Tariff> get tariffs => List.unmodifiable(_tariffs);
  LatLng? get driverLocation => _driverLocation;

  OrderLocation? get pendingPickup => _pendingPickup;
  OrderLocation? get pendingDropoff => _pendingDropoff;
  List<OrderLocation> get pendingWaypoints => List.unmodifiable(_pendingWaypoints);
  Tariff? get selectedTariff => _selectedTariff;
  double? get estimatedPrice => _estimatedPrice;
  double get surgeMultiplier => _surgeMultiplier;
  bool get isSurging => _surgeMultiplier > 1.0;
  bool get hasActiveOrder => _activeOrder != null && _activeOrder!.isActive;
  String get serviceType => _serviceType;
  bool get isCargo => _serviceType == 'cargo';
  bool get isSubmittingTip => _isSubmittingTip;
  String? get tipError => _tipError;
  bool get isTipAlreadyGiven => _tipAlreadyGiven;

  DateTime? get scheduledAt => _scheduledAt;
  bool get isScheduledBooking => _scheduledAt != null;
  List<Order> get scheduledOrders => List.unmodifiable(_scheduledOrders);

  /// Rejalashtirish vaqtini o'rnatadi ([when] `null` — "hozir" ga qaytaradi).
  ///
  /// Backend hozirdan kamida 30 daqiqa keyingi vaqtni talab qiladi
  /// (`SCHEDULED_MIN_LEAD_MINUTES`); tanlagichning o'zi o'tgan va juda
  /// yaqin slotlarni o'chirib qo'yadi, bu esa oxirgi darvoza.
  void setScheduledAt(DateTime? when) {
    _scheduledAt = when;
    notifyListeners();
  }

  /// Haydovchi joylashuvi — alohida kanal orqali.
  ///
  /// U safar davomida har necha soniyada yangilanadi. Ilgari har yangilanish
  /// `notifyListeners()` chaqirardi, ya'ni butun asosiy ekran (xarita bilan
  /// birga) qaytadan qurilardi — bu sezilarli jank manbai edi. Endi faqat
  /// shu notifierga obuna bo'lgan marker qatlami yangilanadi.
  final ValueNotifier<LatLng?> driverLocationListenable =
      ValueNotifier<LatLng?>(null);

  void _setDriverLocation(LatLng? location) {
    _driverLocation = location;
    driverLocationListenable.value = location;
  }

  /// Switch the active vertical (taxi/cargo) and reset any in-progress selection.
  /// Switches the booking flow between 'taxi' and 'cargo'.
  ///
  /// [cargoVehicle] carries the vehicle class picked on the cargo entry screen
  /// ("Kuryer" / "Yengil" / "Yuk") into the order details. It used to be
  /// selected and then silently discarded, so the courier had no idea what
  /// size of vehicle the customer had asked for.
  void setServiceType(String type, {String? cargoVehicle}) {
    _serviceType = type;
    _selectedTariff = null;
    _estimatedPrice = null;
    _cargoDetails = cargoVehicle == null ? null : {'vehicle': cargoVehicle};
    notifyListeners();
  }

  void setCargoDetails(Map<String, dynamic> details) {
    _cargoDetails = details;
    notifyListeners();
  }

  void _setState(OrderProviderState state) {
    _state = state;
    notifyListeners();
  }

  void setPendingPickup(OrderLocation location) {
    _pendingPickup = location;
    notifyListeners();
  }

  void setPendingDropoff(OrderLocation location) {
    _pendingDropoff = location;
    notifyListeners();
  }

  /// Adds an intermediate stop, up to [maxWaypoints]. Silently ignores
  /// additions past the limit — callers (e.g. destination_screen) should
  /// hide/disable the "add stop" action once the limit is reached rather
  /// than rely on this to surface an error.
  void addWaypoint(OrderLocation location) {
    if (_pendingWaypoints.length >= maxWaypoints) return;
    _pendingWaypoints.add(location);
    notifyListeners();
  }

  void removeWaypoint(int index) {
    if (index < 0 || index >= _pendingWaypoints.length) return;
    _pendingWaypoints.removeAt(index);
    notifyListeners();
  }

  void clearWaypoints() {
    _pendingWaypoints.clear();
    notifyListeners();
  }

  void selectTariff(Tariff tariff) {
    _selectedTariff = tariff;
    notifyListeners();
  }

  Future<void> loadTariffs() async {
    try {
      final response = await _apiClient.get(
        '${ApiEndpoints.tariffs}?serviceType=$_serviceType',
      );
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _tariffs =
          list.map((e) => Tariff.fromJson(e as Map<String, dynamic>)).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('[OrderProvider] loadTariffs error: $e');
    }
  }

  // ==========================================================================
  // XIZMAT QAMROVI
  //
  // Shahar OLISH NUQTASIDAN aniqlanadi, foydalanuvchi qo'lda TANLAMAYDI:
  // qo'lda tanlash yana bir xato manbai (odam Angrenni tanlab Toshkentdan
  // buyurtma berishi mumkin), koordinatadan aniqlash esa har doim rost.
  //
  // Bu mobil tomondagi BIRINCHI qatlam: foydalanuvchi xizmat yo'q hududda
  // ekanini buyurtma berishdan OLDIN biladi. Oxirgi so'zni baribir server
  // aytadi (`POST /orders` → 400) — [createOrder] uning xabarini ko'rsatadi.
  // ==========================================================================

  CityCoverage get coverage => _coverage;

  /// `GET /cities` — qamrov ro'yxati. Sessiyada bir marta yetarli.
  ///
  /// ⚠️ Xato JIMGINA yutiladi va holat o'zgarmaydi: qamrov ma'lumotining
  /// yo'qligi buyurtma berishga to'sqinlik qilmasligi kerak (bo'sh ro'yxat
  /// = cheklov yo'q). Shu sabab bu yerda `_setState(error)` YO'Q — aks
  /// holda bosh ekrandagi CTA sababsiz "yuklanmoqda"/xato holatiga tushib
  /// qolardi.
  Future<void> loadCities() {
    if (_coverage.hasData) return Future<void>.value();
    // ⚠️ Tozalash `_fetchCities` ning `finally` blokida EMAS, `whenComplete`
    // da: so'rov SINXRON yiqilsa (masalan `Dio` argumentni tekshirib darhol
    // otsa) `finally` quyidagi `??=` tayinlanishidan OLDIN ishlardi, ya'ni
    // tugagan future maydonga qaytadan yozilib qolardi va keyingi
    // `loadCities()` abadiy o'sha bo'sh natijani qaytarardi — bir marta
    // yiqilgan qamrov sessiya oxirigacha tiklanmasdi.
    // `whenComplete` qayta chaqiruvi mikrotaskda ishlaydi, ya'ni tayinlash
    // ALLAQACHON bo'lib bo'lgan.
    return _citiesInFlight ??= _fetchCities().whenComplete(() {
      // Yiqilgan urinishdan keyin qayta so'rashga yo'l ochiq qoladi.
      _citiesInFlight = null;
    });
  }

  Future<void> _fetchCities() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.cities);
      _coverage = CityCoverage.fromResponse(response.data);
      notifyListeners();
    } catch (e) {
      debugPrint('[OrderProvider] loadCities error: $e');
    }
  }

  /// [lat]/[lng] ga eng yaqin xizmat hududi (ma'lumot bo'lmasa `null`).
  ServiceCity? nearestServiceCity(double lat, double lng) =>
      _coverage.nearestTo(lat, lng);

  /// Nuqta xizmat hududidan tashqarida bo'lsa — foydalanuvchiga
  /// ko'rsatiladigan sabab, aks holda `null`.
  ///
  /// Xabar ikki qismdan iborat: NIMA bo'lgani va NIMA qilish mumkinligi
  /// (eng yaqin hudud nomi). Faqat "xizmat yo'q" deyish odamni boshi berk
  /// ko'chada qoldiradi.
  String? coverageWarningFor(double lat, double lng) {
    if (_coverage.isServiceable(lat, lng)) return null;
    final nearest = _coverage.nearestTo(lat, lng);
    if (nearest == null) return null;
    return "Bu hududda hozircha xizmat ko'rsatilmaymiz. "
        'Eng yaqin xizmat hududi: ${nearest.name}.';
  }

  /// Tanlangan olish nuqtasi bo'yicha ogohlantirish — buyurtma tugmasini
  /// o'chirish qarori shundan chiqadi.
  String? get coverageWarning {
    final pickup = _pendingPickup;
    if (pickup == null) return null;
    return coverageWarningFor(pickup.lat, pickup.lng);
  }

  bool get isPickupOutsideCoverage => coverageWarning != null;

  // Route geometry + distance/duration for the pending pickup/dropoff pair,
  // fetched from OSRM by the tariff-select screen. Kept here (rather than
  // local widget state) so price estimation and the route line share one
  // source of truth.
  List<LatLng> _routePoints = [];
  double? _routeDistanceKm;
  double? _routeDurationMin;

  List<LatLng> get routePoints => List.unmodifiable(_routePoints);
  double? get routeDistanceKm => _routeDistanceKm;
  double? get routeDurationMin => _routeDurationMin;

  void setRoute({
    required List<LatLng> points,
    required double distanceKm,
    required double durationMin,
  }) {
    _routePoints = points;
    _routeDistanceKm = distanceKm;
    _routeDurationMin = durationMin;
    notifyListeners();
  }

  /// Backend'ning POST /orders/calculate-price chaqiruvi.
  ///
  /// Olish VA tushish nuqtalari yuboriladi:
  ///
  /// · Olish nuqtasi — hudud koeffitsienti (surge) uchun. Usiz backend faqat
  ///   tarifning qo'lda qo'yilgan koeffitsientini qo'llay oladi.
  ///
  /// · Tushish nuqtasi — bu YANGI va u eng muhim. Backend marshrutni O'ZI
  ///   hisoblaydi va bu yerdagi `distanceKm` ni e'tiborga olmaydi.
  ///
  ///   ⚠️ NEGA: buyurtma yaratilganda narx baribir server tomonda
  ///   hisoblanadi. Ilgari baholash mijozning OSRM raqamiga tayanardi,
  ///   buyurtma esa serverning haversine (to'g'ri chiziq) raqamiga — ya'ni
  ///   yo'lovchi ko'rgan narx bilan yozilgan narx boshqa-boshqa sonlar edi.
  ///   Endi ikkalasi ham bitta hisob-kitobdan chiqadi va ko'rsatilgan summa
  ///   MARSHRUT uchun qat'iy: tirbandlik yoki uzunroq yo'l narxni
  ///   oshirmaydi.
  ///
  ///   ⚠️ KUTISH BU KAFOLATDAN TASHQARIDA. Haydovchi yetib kelgach bepul
  ///   oyna tugasa, kutish haqi shu summa USTIGA qo'shiladi (backend
  ///   `waiting-charge.ts`). Sababi: qat'iy narx haydovchi boshqarmaydigan
  ///   noaniqlikni yopadi, kutish esa YO'LOVCHI boshqaradigan narsa.
  ///   Shuning uchun ekranda ham "narx belgilangan, kutish alohida" degan
  ///   ma'no berilishi shart — yig'ilayotgan summa
  ///   `active_order_view.dart` da real vaqtda ko'rsatiladi.
  Future<void> estimatePrice({
    required double distanceKm,
    required double durationMin,
    required String tariffId,
  }) async {
    try {
      final pickup = _pendingPickup;
      final dropoff = _pendingDropoff;
      final response = await _apiClient.post(
        ApiEndpoints.estimatePrice,
        data: {
          'tariffId': tariffId,
          // Server marshrutni hisoblay olmasa (OSRM javob bermasa) shu
          // qiymatlar zaxira sifatida ishlatiladi.
          'distanceKm': distanceKm,
          'durationMin': durationMin,
          if (pickup != null) 'pickupLat': pickup.lat,
          if (pickup != null) 'pickupLng': pickup.lng,
          if (dropoff != null) 'dropoffLat': dropoff.lat,
          if (dropoff != null) 'dropoffLng': dropoff.lng,
        },
      );
      final data = response.data as Map<String, dynamic>;
      final payload = data['data'] as Map<String, dynamic>;
      _estimatedPrice = (payload['price'] as num?)?.toDouble() ?? 0;
      _surgeMultiplier = (payload['surgeMultiplier'] as num?)?.toDouble() ?? 1.0;
      // Server o'z masofasini qaytaradi — ekranda ko'rsatiladigan masofa ham
      // narx asosidagi masofa bilan bir xil bo'lishi kerak.
      final serverDistance = (payload['distanceKm'] as num?)?.toDouble();
      if (serverDistance != null && serverDistance > 0) {
        _routeDistanceKm = serverDistance;
      }
      notifyListeners();
    } catch (e) {
      debugPrint('[OrderProvider] estimatePrice error: $e');
    }
  }

  Future<bool> createOrder() async {
    if (_pendingPickup == null ||
        _pendingDropoff == null ||
        _selectedTariff == null) {
      _error = 'Manzil va tarif tanlanmagan';
      _setState(OrderProviderState.error);
      return false;
    }

    // Qamrov darvozasi — tarmoqqa chiqishdan oldin. UI tugmani allaqachon
    // o'chirib qo'ygan, bu esa oxirgi mahalliy tekshiruv (masalan buyurtma
    // saqlangan manzil orqali to'g'ridan-to'g'ri berilsa).
    final blocked = coverageWarning;
    if (blocked != null) {
      _error = blocked;
      _setState(OrderProviderState.error);
      return false;
    }

    _error = null;
    _setState(OrderProviderState.loading);

    try {
      // Matches backend's CreateOrderDto (create-order.dto.ts) exactly — it
      // takes flat pickupLat/pickupLng/pickupAddress (and dropoff* likewise),
      // not nested pickup/dropoff objects; sending the nested shape gets
      // rejected with "property pickup should not exist" plus "pickupLat
      // must be a number" (whitelist validation strips the unknown nested
      // key, then fails on the now-missing flat ones).
      final response = await _apiClient.post(
        ApiEndpoints.createOrder,
        data: {
          'tariffId': _selectedTariff!.id,
          'pickupLat': _pendingPickup!.lat,
          'pickupLng': _pendingPickup!.lng,
          'pickupAddress': _pendingPickup!.address,
          'dropoffLat': _pendingDropoff!.lat,
          'dropoffLng': _pendingDropoff!.lng,
          'dropoffAddress': _pendingDropoff!.address,
          'serviceType': _serviceType,
          if (_pendingWaypoints.isNotEmpty)
            'waypoints': _pendingWaypoints
                .map((w) => {'lat': w.lat, 'lng': w.lng, 'address': w.address})
                .toList(),
          if (_cargoDetails != null) 'details': _cargoDetails,
          // Backend `@IsISO8601({strict: true})` kutadi va `timestamptz`
          // ga yozadi — mahalliy vaqt yuborilsa O'zbekistonda (UTC+5)
          // safar 5 soatga surilib ketardi.
          if (_scheduledAt != null)
            'scheduledAt': _scheduledAt!.toUtc().toIso8601String(),
        },
      );

      final data = response.data as Map<String, dynamic>;
      final order = Order.fromJson(data['data'] as Map<String, dynamic>);
      final wasScheduled = _scheduledAt != null;

      // ⚠️ TANLOV DARHOL TOZALANADI — muvaffaqiyatning IKKALA shoxida ham.
      // Aks holda keyingi oddiy safar jimgina o'tib ketgan vaqtga
      // rejalashtirilardi va backend 400 qaytarardi ("kamida 30 daqiqa
      // keyin bo'lishi kerak") — foydalanuvchi uchun sababsiz xato.
      _scheduledAt = null;

      if (wasScheduled) {
        // Rejalashtirilgan buyurtmada `_activeOrder` O'RNATILMAYDI va
        // soket tinglovchilari QO'SHILMAYDI: kuzatiladigan hech narsa
        // yo'q (haydovchi hali qidirilmayapti ham), va `_activeOrder`
        // to'ldirilsa bosh ekran kuzatuv rejimiga qulflanib qolardi.
        _scheduledOrders = [..._scheduledOrders, order]
          ..sort((a, b) => (a.scheduledAt ?? a.createdAt)
              .compareTo(b.scheduledAt ?? b.createdAt));
      } else {
        _activeOrder = order;
        _listenToOrderEvents();
      }

      _setState(OrderProviderState.success);
      return true;
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(OrderProviderState.error);
      return false;
    }
  }

  void _listenToOrderEvents() {
    if (_activeOrder != null) {
      _socketService.emit(SocketEvents.joinOrder, {'orderId': _activeOrder!.id});
    }

    _socketService.on(SocketEvents.driverLocationUpdate, (data) {
      if (data is Map) {
        final lat = (data['lat'] as num?)?.toDouble();
        final lng = (data['lng'] as num?)?.toDouble();
        if (lat != null && lng != null) {
          _setDriverLocation(LatLng(lat, lng));
        }
      }
    });

    // orders.service.ts's 'driver' payload here only carries
    // id/userId/carModel/carNumber/rating (no name/phone — those are only on
    // the flat User entity GET /orders/:id returns), so apply it optimistically
    // for an instant status flip, then refetch to backfill the rest.
    _socketService.on(SocketEvents.orderAccepted, (data) {
      if (data is Map && _activeOrder != null) {
        final driver = data['driver'];
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.driverAssigned,
          driver: driver is Map<String, dynamic>
              ? Driver.fromJson(driver)
              : _activeOrder!.driver,
        );
        notifyListeners();
        _refreshActiveOrder();
      }
    });

    // ⚠️ KUTISH SHARTNOMASI SHU PAKETDAN OLINADI. Server `arrivedAt` ni
    // O'Z soatidan yuboradi va yo'lovchi hisoblagichi AYNAN shundan
    // hisoblaydi — qurilma soatidan emas. Aks holda haydovchi bilan
    // yo'lovchi har xil raqam ko'rardi va bu aynan tuzatilayotgan nuqson
    // edi (kutish endi PUL undiradi, ya'ni raqam nizoli).
    //
    // Paket kelmasa yoki `arrivedAt` yaroqsiz bo'lsa maydon `null` qolib,
    // hisoblagich umuman ko'rsatilmaydi; keyingi to'liq yangilanish
    // (`_refreshActiveOrder` / `checkActiveOrder`) uni REST javobidan
    // to'ldiradi, chunki backend uchala maydonni har bir buyurtma
    // javobiga qo'shadi.
    _socketService.on(SocketEvents.orderArrived, (data) {
      if (_activeOrder != null) {
        final payload = data is Map ? data : const {};
        final rawArrivedAt = payload['arrivedAt'];
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.driverArrived,
          arrivedAt: rawArrivedAt is String
              ? DateTime.tryParse(rawArrivedAt)?.toLocal()
              : null,
          freeWaitMinutes: (payload['freeWaitMinutes'] as num?)?.toInt(),
          waitingPricePerMinute:
              (payload['waitingPricePerMinute'] as num?)?.toInt(),
        );
        notifyListeners();
      }
    });

    _socketService.on(SocketEvents.orderInProgress, (data) {
      if (_activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(status: OrderStatus.inProgress);
        notifyListeners();
      }
    });

    _socketService.on(SocketEvents.orderCompleted, (data) {
      if (data is Map && _activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.completed,
          actualPrice: (data['finalPrice'] as num?)?.toDouble(),
          distanceKm: (data['actualDistanceKm'] as num?)?.toDouble(),
          durationMin: (data['actualDurationMin'] as num?)?.toInt(),
        );
        // Store info needed for post-trip rating before clearing the order.
        pendingRatingOrderId = _activeOrder!.id;
        pendingRatingDriverName = _activeOrder!.driver?.name ?? 'Haydovchi';
        notifyListeners();
        _cleanupOrderListeners();
        loadOrderHistory();
      }
    });

    _socketService.on(SocketEvents.orderCancelled, (data) {
      if (_activeOrder != null) {
        final reason = data is Map ? data['reason'] as String? : null;
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.cancelled,
          cancelReason: reason,
        );
        notifyListeners();
        _cleanupOrderListeners();
      }
    });

    // matching.service.ts's handleNoDriversFound already cancels the order
    // server-side (status -> cancelled) and emits ONLY this event, never
    // 'order:cancelled' — without this listener the app kept showing
    // "searching..." forever, and tapping cancel afterward 400'd with
    // "Cannot cancel order with status cancelled" since it already was.
    _socketService.on(SocketEvents.noDriversFound, (data) {
      if (_activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(
          status: OrderStatus.cancelled,
          cancelReason: "Yaqin atrofda haydovchi topilmadi",
        );
        noDriversFoundMessage =
            "Yaqin atrofda haydovchi topilmadi. Birozdan so'ng qayta urinib ko'ring.";
        notifyListeners();
        _cleanupOrderListeners();
      }
    });
  }

  // Socket payloads for order:accepted only carry the driver's
  // id/carModel/carNumber/rating; re-fetch the full order so name/phone (only
  // present on GET /orders/:id's flat User-backed driver object) show up too.
  Future<void> _refreshActiveOrder() async {
    if (_activeOrder == null) return;
    try {
      final response =
          await _apiClient.get(ApiEndpoints.orderById(_activeOrder!.id));
      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(data['data'] as Map<String, dynamic>);
      notifyListeners();
    } catch (e) {
      debugPrint('[OrderProvider] _refreshActiveOrder error: $e');
    }
  }

  void _cleanupOrderListeners() {
    if (_activeOrder != null) {
      _socketService.emit(SocketEvents.leaveOrder, {'orderId': _activeOrder!.id});
    }
    _socketService.off(SocketEvents.driverLocationUpdate);
    _socketService.off(SocketEvents.orderAccepted);
    _socketService.off(SocketEvents.orderArrived);
    _socketService.off(SocketEvents.orderInProgress);
    _socketService.off(SocketEvents.orderCompleted);
    _socketService.off(SocketEvents.orderCancelled);
    _socketService.off(SocketEvents.noDriversFound);
    _setDriverLocation(null);
  }

  Future<void> cancelOrder({String? reason}) async {
    if (_activeOrder == null) return;

    _setState(OrderProviderState.loading);
    try {
      await _apiClient.patch(
        ApiEndpoints.cancelOrder(_activeOrder!.id),
        data: reason != null ? {'reason': reason} : null,
      );
      _cleanupOrderListeners();
      _activeOrder = null;
      _setState(OrderProviderState.idle);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(OrderProviderState.error);
    }
  }

  // GET /orders/history has no status filter server-side and returns
  // {orders, total, page, limit} — the active order (if any) is derived from
  // the first page rather than requested directly.
  Future<void> checkActiveOrder() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.orderHistory);
      final data = response.data as Map<String, dynamic>;
      final list =
          (data['data'] as Map<String, dynamic>)['orders'] as List<dynamic>;
      final orders = list.map((e) => Order.fromJson(e as Map<String, dynamic>));
      final active = orders.where((o) => o.isActive);
      if (active.isNotEmpty) {
        _activeOrder = active.first;
        _listenToOrderEvents();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[OrderProvider] checkActiveOrder error: $e');
    }
  }

  /// GET /orders/scheduled — yo'lovchining kelgusi rejalari.
  ///
  /// Xato bo'lsa umumiy [_state] ga TEGMAYDI: bu ro'yxat asosiy buyurtma
  /// oqimidan mustaqil va uning yuklanmasligi bosh ekrandagi CTA ni
  /// "yuklanmoqda" holatiga tushirmasligi kerak.
  Future<void> loadScheduledOrders() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.scheduledOrders);
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _scheduledOrders =
          list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
      notifyListeners();
    } catch (e) {
      debugPrint('[OrderProvider] loadScheduledOrders error: $e');
    }
  }

  /// Rejalashtirilgan safarni bekor qiladi.
  ///
  /// Alohida endpoint yo'q — backend `SCHEDULED` ni bekor qilinadigan
  /// holatlar ro'yxatiga qo'shgan, ya'ni odatdagi
  /// `PATCH /orders/:id/cancel` ishlaydi.
  ///
  /// ⚠️ [cancelOrder] dan farqi: u `_activeOrder` bilan ishlaydi, bu esa
  /// ro'yxatdagi ELEMENT bilan — rejalashtirilgan buyurtma hech qachon
  /// `_activeOrder` bo'lmaydi.
  Future<bool> cancelScheduledOrder(String orderId, {String? reason}) async {
    try {
      await _apiClient.patch(
        ApiEndpoints.cancelOrder(orderId),
        data: reason != null ? {'reason': reason} : null,
      );
      _scheduledOrders =
          _scheduledOrders.where((o) => o.id != orderId).toList();
      notifyListeners();
      return true;
    } catch (e) {
      _error = extractErrorMessage(e);
      notifyListeners();
      return false;
    }
  }

  Future<void> loadOrderHistory() async {
    _setState(OrderProviderState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.orderHistory);
      final data = response.data as Map<String, dynamic>;
      final list =
          (data['data'] as Map<String, dynamic>)['orders'] as List<dynamic>;
      _orderHistory =
          list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
      _setState(OrderProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(OrderProviderState.error);
    }
  }

  /// POST /orders/:id/tip — safar tugagandan keyin haydovchiga chaqim.
  ///
  /// [amount] BUTUN so'm bo'lishi shart (backend `@IsInt`), 1 000..200 000.
  /// Muvaffaqiyatda `true`, aks holda `false` qaytaradi va sababni
  /// [tipError] ga yozadi — chaqiruvchi ekran xabarni o'zi ko'rsatadi.
  Future<bool> addTip({required String orderId, required int amount}) async {
    _isSubmittingTip = true;
    _tipError = null;
    // Har urinishda noldan: bayroqlar OXIRGI urinish haqida gapiradi,
    // aks holda boshqa buyurtmadagi eski 409 yangi safarni ham blokladi.
    _tipAlreadyGiven = false;
    notifyListeners();
    try {
      await _apiClient.post(
        ApiEndpoints.addTip(orderId),
        data: {'amount': amount},
      );
      _isSubmittingTip = false;
      notifyListeners();
      return true;
    } catch (e) {
      // 409 alohida eslab qolinadi: qayta urinish har doim yana 409 beradi,
      // shuning uchun UI summa tanlashni butunlay yopishi kerak.
      _tipAlreadyGiven = e is DioException && e.response?.statusCode == 409;
      _tipError = _tipFailureMessage(e);
      _isSubmittingTip = false;
      notifyListeners();
      return false;
    }
  }

  /// Chaqim xatolarini foydalanuvchi tushunadigan xabarga o'giradi.
  ///
  /// NEGA backend matnini shundayligicha ko'rsatmaymiz: 400 kodi ostida
  /// to'rt xil sabab bor (safar tugamagan · haydovchi yo'q · 24 soat o'tgan ·
  /// mablag' yetarli emas) va ulardan faqat bittasi foydalanuvchi TUZATA
  /// oladigan holat. Hamyon holati alohida ajratiladi — unda keyingi qadam
  /// aniq: hamyonni to'ldirish.
  static String _tipFailureMessage(Object error) {
    if (error is! DioException) return extractErrorMessage(error);

    final status = error.response?.statusCode;
    if (status == 409) {
      return 'Bu safar uchun chaqim allaqachon berilgan.';
    }
    if (status == 403) {
      return 'Bu safar sizga tegishli emas.';
    }

    final serverMessage = extractErrorMessage(error);
    if (status == 400) {
      // Backend matni o'zgarishi mumkin, shuning uchun o'zak bo'yicha
      // qidiriladi: "mablag'" / "mablag" (apostrofsiz yozuv ham).
      if (serverMessage.toLowerCase().contains('mablag')) {
        return "Hamyonda mablag' yetarli emas. Hamyonni to'ldiring yoki "
            'kichikroq summa tanlang.';
      }
      return serverMessage;
    }
    return serverMessage;
  }

  void clearPendingRating() {
    pendingRatingOrderId = null;
    pendingRatingDriverName = null;
    notifyListeners();
  }

  void clearNoDriversFoundMessage() {
    noDriversFoundMessage = null;
    notifyListeners();
  }

  void clearPendingOrder() {
    _pendingPickup = null;
    _pendingDropoff = null;
    _selectedTariff = null;
    _estimatedPrice = null;
    // ⚠️ Rejalashtirish tanlovi ham tozalanadi — u ham "qurilayotgan
    // buyurtma" holatining bir qismi. `createOrder` uni allaqachon
    // tozalaydi; bu esa yarim yo'lda tashlab ketilgan oqim uchun.
    _scheduledAt = null;
    _routePoints = [];
    _routeDistanceKm = null;
    _routeDurationMin = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    if (_state == OrderProviderState.error) {
      _setState(OrderProviderState.idle);
    }
  }

  @override
  void dispose() {
    _cleanupOrderListeners();
    driverLocationListenable.dispose();
    super.dispose();
  }
}

OrderProvider buildOrderProvider() => OrderProvider(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
    );
