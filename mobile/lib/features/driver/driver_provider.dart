import 'dart:async';
import 'dart:io';

import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_ping_gate.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/shared/models/driver.dart';
import 'package:angren_taxi/shared/models/driver_bonus_progress.dart';
import 'package:angren_taxi/shared/models/driver_document.dart';
import 'package:angren_taxi/shared/models/driver_earnings_breakdown.dart';
import 'package:angren_taxi/shared/models/driver_rating_stats.dart';
import 'package:angren_taxi/shared/models/driver_service.dart';
import 'package:angren_taxi/shared/models/driver_verification.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/withdrawal_request.dart';
import 'package:dio/dio.dart' show MultipartFile, FormData;
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';

enum DriverProviderState { idle, loading, success, error }

// Local (client-side) lifecycle of a single KYC document upload, tracked
// per DriverDocumentType so the onboarding screen can show independent
// progress/status per document. This is distinct from `reviewStatus` on
// DriverDocument, which is the backend's pending/approved/rejected verdict
// once a document has been uploaded and (later) reviewed by an admin.
enum DriverDocumentUploadStatus { idle, uploading, uploaded, failed }

class DriverDocumentUploadState {
  const DriverDocumentUploadState({
    this.status = DriverDocumentUploadStatus.idle,
    this.progress = 0,
    this.error,
  });

  final DriverDocumentUploadStatus status;
  final double progress;
  final String? error;

  DriverDocumentUploadState copyWith({
    DriverDocumentUploadStatus? status,
    double? progress,
    String? error,
  }) {
    return DriverDocumentUploadState(
      status: status ?? this.status,
      progress: progress ?? this.progress,
      error: error,
    );
  }
}

// Whether this driver-flavor account can access the normal driver home
// screen yet. A fresh login always starts as `unknown`; `checkOnboarding`
// resolves it by calling GET /drivers/me.
enum DriverOnboardingStatus {
  unknown,
  needsApplication,
  pendingApproval,
  approved,
}

class DriverProvider extends ChangeNotifier {
  DriverProvider({
    required ApiClient apiClient,
    required SocketService socketService,
    required LocationService locationService,
    required LocalStorage localStorage,
  })  : _apiClient = apiClient,
        _socketService = socketService,
        _locationService = locationService,
        _localStorage = localStorage;

  final ApiClient _apiClient;
  final SocketService _socketService;
  final LocationService _locationService;
  final LocalStorage _localStorage;

  DriverProviderState _state = DriverProviderState.idle;
  String? _error;
  Driver? _driver;
  DriverOnboardingStatus _onboardingStatus = DriverOnboardingStatus.unknown;
  Order? _activeOrder;
  Order? _pendingOffer;
  List<Order> _orderHistory = [];
  double _todayEarnings = 0;
  bool _isOnline = false;
  StreamSubscription<Position>? _locationSubscription;
  List<DriverDocument> _documents = [];
  final Map<DriverDocumentType, DriverDocumentUploadState>
      _documentUploadStates = {};
  // Serverdan boshqariladigan tekshiruv ro'yxati (hujjat muddatlari +
  // avtomobil suratlari). Yuqoridagi `_documents` dan FARQ QILADI: u eski,
  // qattiq kodlangan KYC oqimi; bu esa server aytgan har qanday talabni
  // ko'rsatadi. Yuklash holati `code` (erkin satr) bo'yicha kuzatiladi.
  DriverVerification _verification = DriverVerification.unrestricted;
  bool _isLoadingVerification = false;
  String? _verificationError;
  final Map<String, DriverDocumentUploadState> _verificationUploadStates = {};
  // Haydovchi qaysi vertikallardan buyurtma olishi. Ro'yxatning O'ZI ham
  // serverdan keladi — shared/models/driver_service.dart dagi izohga qarang.
  DriverServices _services = DriverServices.empty;
  bool _isLoadingServices = false;
  String? _servicesError;
  bool _isSavingServices = false;
  String? _servicesSaveError;
  List<WithdrawalRequest> _withdrawals = [];
  bool _isSubmittingWithdrawal = false;
  String? _withdrawalError;

  /// Haydovchining HAQIQIY pul holati — `GET /payments/wallet`.
  ///
  /// ⚠️ NEGA `Driver.balance` EMAS. Ekranda ilgari o'sha ustun ko'rsatilardi,
  /// server esa yechishni butunlay boshqa raqamga — tranzaksiyalar daftariga
  /// — solishtirardi. Ikkalasi bir xil emas: yechib olish daftarni
  /// debetlaydi, ustunga esa tegmaydi, ya'ni birinchi yechishdan keyin ular
  /// abadiy ajralib ketardi. Haydovchi ilovada 500 000 ko'rib, "yechish"
  /// bosganda serverdan "summa balansdan oshdi" javobini olardi.
  ///
  /// `null` = hali o'qilmagan (yoki so'rov yiqilgan). Bu 0 dan FARQ QILADI:
  /// nolni ko'rsatish "puling yo'q" degan yolg'on bo'lardi.
  double? _walletBalance;
  DriverEarningsBreakdown _earningsBreakdown = DriverEarningsBreakdown.empty;
  List<DriverBonusProgress> _bonusProgress = [];
  DriverRatingStats _ratingStats = DriverRatingStats.empty;
  // Most recent fix observed from the location stream started in
  // [_startLocationUpdates]. Exposed so screens (e.g. the SOS button on
  // TripScreen) can reuse the already-tracked position instead of requesting
  // a fresh one from the OS.
  Position? _lastKnownPosition;

  /// Joylashuv yuborish ritmini boshqaradi (harakatda tez, turganda sekin).
  final LocationPingGate _pingGate = LocationPingGate();

  DriverProviderState get state => _state;
  String? get error => _error;
  Driver? get driver => _driver;
  DriverOnboardingStatus get onboardingStatus => _onboardingStatus;
  Order? get activeOrder => _activeOrder;
  Order? get pendingOffer => _pendingOffer;
  List<Order> get orderHistory => List.unmodifiable(_orderHistory);
  double get todayEarnings => _todayEarnings;
  bool get isOnline => _isOnline;
  bool get hasActiveOrder => _activeOrder != null;
  List<DriverDocument> get documents => List.unmodifiable(_documents);
  Map<DriverDocumentType, DriverDocumentUploadState>
      get documentUploadStates => Map.unmodifiable(_documentUploadStates);
  DriverVerification get verification => _verification;
  bool get isLoadingVerification => _isLoadingVerification;
  String? get verificationError => _verificationError;
  DriverServices get services => _services;
  bool get isLoadingServices => _isLoadingServices;
  String? get servicesError => _servicesError;
  bool get isSavingServices => _isSavingServices;
  String? get servicesSaveError => _servicesSaveError;
  List<WithdrawalRequest> get withdrawals => List.unmodifiable(_withdrawals);

  double? get walletBalance => _walletBalance;

  /// Qoldiq manfiy — haydovchi platformaga qarzdor (asosan naqd
  /// safarlarning komissiyasi). Bunday holatda onlayn chiqib bo'lmaydi.
  bool get hasWalletDebt => (_walletBalance ?? 0) < 0;
  bool get isSubmittingWithdrawal => _isSubmittingWithdrawal;
  String? get withdrawalError => _withdrawalError;
  Position? get lastKnownPosition => _lastKnownPosition;
  DriverEarningsBreakdown get earningsBreakdown => _earningsBreakdown;
  List<DriverBonusProgress> get bonusProgress =>
      List.unmodifiable(_bonusProgress);
  DriverRatingStats get ratingStats => _ratingStats;

  // Test-only seam: lets widget tests simulate the location stream having
  // already emitted a fix (normally only set by [_emitLocation] while the
  // real Geolocator stream from [_startLocationUpdates] is running), without
  // pulling in a fake platform channel.
  @visibleForTesting
  void debugSetLastKnownPositionForTest(Position position) {
    _lastKnownPosition = position;
  }

  // Test-only seam: buyurtma taklifi odatda socket hodisasi bilan keladi
  // (`newOrderOffer`), uni vidjet testida haydash uchun butun socket
  // qatlamini soxtalashtirish kerak bo'lardi. Taklif ekrani esa aynan shu
  // maydonga qarab quriladi.
  @visibleForTesting
  void debugSetPendingOfferForTest(Order offer) {
    _pendingOffer = offer;
    notifyListeners();
  }

  // Most recent uploaded record for a document type, if any (list is newest
  // first per the backend's `order: { uploadedAt: 'DESC' }`).
  DriverDocument? documentFor(DriverDocumentType type) {
    for (final doc in _documents) {
      if (doc.documentType == type) return doc;
    }
    return null;
  }

  DriverDocumentUploadState uploadStateFor(DriverDocumentType type) =>
      _documentUploadStates[type] ?? const DriverDocumentUploadState();

  /// Tekshiruv elementining (erkin satrli `code` bo'yicha) yuklash holati.
  DriverDocumentUploadState verificationUploadStateFor(String code) =>
      _verificationUploadStates[code] ?? const DriverDocumentUploadState();

  void _setState(DriverProviderState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> initialize() async {
    _isOnline = _localStorage.getDriverOnlineStatus();
    await loadProfile();
    // Bosh ekran onlayn tugmasini shu ma'lumotga qarab o'chiradi, shuning
    // uchun u faol buyurtmani tekshirishdan OLDIN kerak.
    await loadDriverVerification();
    await checkActiveOrder();
    if (_isOnline) {
      _startLocationUpdates();
    }
    _listenToSocketEvents();
  }

  Future<void> loadProfile() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverProfile);
      final data = response.data as Map<String, dynamic>;
      _driver = Driver.fromJson(data['data'] as Map<String, dynamic>);
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadProfile error: $e');
    }
  }

  // Called by the onboarding gate screen before entering the driver home
  // screen. GET /drivers/me 403s ("Required roles: driver") for an account
  // that hasn't applied yet, and 404s if the role was promoted but the
  // profile row is somehow missing — both mean "needs application".
  Future<DriverOnboardingStatus> checkOnboarding() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverProfile);
      final data = response.data as Map<String, dynamic>;
      final driverJson = data['data'] as Map<String, dynamic>;
      _driver = Driver.fromJson(driverJson);
      _onboardingStatus = _driver!.userStatus == 'pending'
          ? DriverOnboardingStatus.pendingApproval
          : DriverOnboardingStatus.approved;
    } catch (e) {
      _onboardingStatus = DriverOnboardingStatus.needsApplication;
    }
    notifyListeners();
    return _onboardingStatus;
  }

  Future<bool> applyAsDriver({
    String? carModel,
    String? carNumber,
    String? licensePlate,
    int? carYear,
  }) async {
    _setState(DriverProviderState.loading);
    try {
      await _apiClient.post(
        ApiEndpoints.driverApply,
        data: {
          if (carModel != null && carModel.isNotEmpty) 'carModel': carModel,
          if (carNumber != null && carNumber.isNotEmpty)
            'carNumber': carNumber,
          if (licensePlate != null && licensePlate.isNotEmpty)
            'licensePlate': licensePlate,
          if (carYear != null) 'carYear': carYear,
        },
      );
      _onboardingStatus = DriverOnboardingStatus.pendingApproval;
      _setState(DriverProviderState.success);
      return true;
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
      return false;
    }
  }

  void _setUploadState(
    DriverDocumentType type,
    DriverDocumentUploadState state,
  ) {
    _documentUploadStates[type] = state;
    notifyListeners();
  }

  void _upsertDocument(DriverDocument doc) {
    _documents = [
      doc,
      ..._documents.where((d) => d.documentType != doc.documentType),
    ];
  }

  // GET /drivers/documents — loads this driver's own uploaded KYC documents
  // (backend infers the driver from the JWT, no query param needed here).
  Future<void> loadDriverDocuments() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverDocuments);
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _documents = list
          .map((e) => DriverDocument.fromJson(e as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadDriverDocuments error: $e');
    }
  }

  // POST /drivers/documents (multipart/form-data) — uploads one KYC document
  // photo. Tracks per-document progress/status in [documentUploadStates] so
  // the onboarding screen can render independent indicators per document,
  // separate from the generic [state] used by the rest of this provider.
  Future<bool> uploadDriverDocument(
    DriverDocumentType type,
    File file,
  ) async {
    _setUploadState(
      type,
      const DriverDocumentUploadState(
        status: DriverDocumentUploadStatus.uploading,
      ),
    );
    try {
      final formData = FormData.fromMap({
        'documentType': driverDocumentTypeToApi(type),
        'file': await MultipartFile.fromFile(
          file.path,
          filename: file.path.split('/').last,
        ),
      });
      final response = await _apiClient.post(
        ApiEndpoints.driverDocuments,
        data: formData,
        onSendProgress: (sent, total) {
          if (total <= 0) return;
          _setUploadState(
            type,
            DriverDocumentUploadState(
              status: DriverDocumentUploadStatus.uploading,
              progress: sent / total,
            ),
          );
        },
      );
      final data = response.data as Map<String, dynamic>;
      final doc = DriverDocument.fromJson(data['data'] as Map<String, dynamic>);
      _upsertDocument(doc);
      _setUploadState(
        type,
        const DriverDocumentUploadState(
          status: DriverDocumentUploadStatus.uploaded,
          progress: 1,
        ),
      );
      return true;
    } catch (e) {
      _setUploadState(
        type,
        DriverDocumentUploadState(
          status: DriverDocumentUploadStatus.failed,
          error: extractErrorMessage(e),
        ),
      );
      return false;
    }
  }

  // GET /drivers/me/verification — haydovchi uchun QAYSI tekshiruvlar
  // kerakligini va ularning holatini serverdan oladi.
  //
  // ⚠️ Ro'yxatning o'zi ham serverdan keladi — bu yerda hech qanday talab
  // taxmin qilinmaydi. Xato o'z alohida maydoniga yoziladi (`state`/`error`
  // ga EMAS), aks holda bosh ekrandagi onlayn tugmasi tekshiruv so'rovi
  // yiqilgani uchun "xato" holatiga tushib qolardi.
  Future<void> loadDriverVerification() async {
    _isLoadingVerification = true;
    notifyListeners();
    try {
      final response = await _apiClient.get(ApiEndpoints.driverVerification);
      final data = response.data as Map<String, dynamic>;
      final payload = data['data'];
      _verification = payload is Map<String, dynamic>
          ? DriverVerification.fromJson(payload)
          : DriverVerification.unrestricted;
      _verificationError = null;
    } catch (e) {
      _verificationError = extractErrorMessage(e);
    } finally {
      _isLoadingVerification = false;
      notifyListeners();
    }
  }

  void _setVerificationUploadState(
    String code,
    DriverDocumentUploadState state,
  ) {
    _verificationUploadStates[code] = state;
    notifyListeners();
  }

  // POST /drivers/me/verification/:code (multipart/form-data, maydon "file").
  // Javob — YUBORILGAN ELEMENTNING o'zi, `pending_review` holatida.
  //
  // Muvaffaqiyatdan keyin ro'yxat qayta so'ralmaydi: server aynan shu
  // elementni qaytaradi va uni joyiga qo'yish yetarli. `canGoOnline` esa
  // bir yuklashdan o'zgarmaydi — element `pending_review` ga o'tadi, ya'ni
  // menejer ko'rmaguncha blok saqlanadi.
  Future<bool> uploadVerificationItem(String code, File file) async {
    _setVerificationUploadState(
      code,
      const DriverDocumentUploadState(
        status: DriverDocumentUploadStatus.uploading,
      ),
    );
    try {
      final formData = FormData.fromMap({
        'file': await MultipartFile.fromFile(
          file.path,
          filename: file.path.split('/').last,
        ),
      });
      final response = await _apiClient.post(
        ApiEndpoints.driverVerificationUpload(code),
        data: formData,
        onSendProgress: (sent, total) {
          if (total <= 0) return;
          _setVerificationUploadState(
            code,
            DriverDocumentUploadState(
              status: DriverDocumentUploadStatus.uploading,
              progress: sent / total,
            ),
          );
        },
      );
      final data = response.data as Map<String, dynamic>;
      final payload = data['data'];
      if (payload is Map<String, dynamic>) {
        _verification = _verification.withItem(
          DriverVerificationItem.fromJson(payload),
        );
      }
      _setVerificationUploadState(
        code,
        const DriverDocumentUploadState(
          status: DriverDocumentUploadStatus.uploaded,
          progress: 1,
        ),
      );
      return true;
    } catch (e) {
      _setVerificationUploadState(
        code,
        DriverDocumentUploadState(
          status: DriverDocumentUploadStatus.failed,
          error: extractErrorMessage(e),
        ),
      );
      return false;
    }
  }

  // GET /drivers/me/services — haydovchi qaysi xizmat turlaridan buyurtma
  // olishi va qaysilarini YOQA OLMASLIGI (tekshiruv talablari bajarilmagan).
  //
  // ⚠️ Xato o'z alohida maydoniga yoziladi (`state`/`error` ga EMAS): bu
  // so'rov yiqilgani uchun bosh ekrandagi onlayn tugmasi "xato" holatiga
  // tushib qolmasligi kerak — `loadDriverVerification` bilan bir mantiq.
  Future<void> loadDriverServices() async {
    _isLoadingServices = true;
    notifyListeners();
    try {
      final response = await _apiClient.get(ApiEndpoints.driverServices);
      final data = response.data as Map<String, dynamic>;
      final payload = data['data'];
      _services = payload is Map<String, dynamic>
          ? DriverServices.fromJson(payload)
          : DriverServices.empty;
      _servicesError = null;
    } catch (e) {
      _servicesError = extractErrorMessage(e);
    } finally {
      _isLoadingServices = false;
      notifyListeners();
    }
  }

  // PATCH /drivers/me/services — tanlangan turlarni saqlaydi.
  //
  // Javob GET bilan BIR XIL shaklda qaytadi, shuning uchun ro'yxat qayta
  // so'ralmaydi: server yangilangan holatni (nima yoqildi, nima hamon
  // bloklangan) o'zi aytadi.
  //
  // 400 — tanlangan turlardan birining tekshiruv talablari bajarilmagan.
  // Sabab o'zbekcha matn sifatida serverdan keladi va `servicesSaveError`
  // orqali ekranga chiqadi; bu yerda hech narsa taxmin qilinmaydi.
  Future<bool> updateDriverServices(List<String> serviceTypes) async {
    _isSavingServices = true;
    _servicesSaveError = null;
    notifyListeners();
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.driverServices,
        data: {'serviceTypes': serviceTypes},
      );
      final data = response.data as Map<String, dynamic>;
      final payload = data['data'];
      if (payload is Map<String, dynamic>) {
        _services = DriverServices.fromJson(payload);
      }
      return true;
    } catch (e) {
      _servicesSaveError = extractErrorMessage(e);
      return false;
    } finally {
      _isSavingServices = false;
      notifyListeners();
    }
  }

  /// Saqlash xatosini tozalaydi — haydovchi tanlovni o'zgartirganda eski
  /// sabab ekranda osilib qolmasligi uchun.
  void clearServicesSaveError() {
    if (_servicesSaveError == null) return;
    _servicesSaveError = null;
    notifyListeners();
  }

  Future<void> goOnline() async {
    _setState(DriverProviderState.loading);
    try {
      await _apiClient
          .patch(ApiEndpoints.driverStatus, data: {'isOnline': true});
      _isOnline = true;
      await _localStorage.saveDriverOnlineStatus(true);
      _socketService.emit(SocketEvents.driverOnline, {});
      _startLocationUpdates();
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> goOffline() async {
    _setState(DriverProviderState.loading);
    try {
      await _apiClient
          .patch(ApiEndpoints.driverStatus, data: {'isOnline': false});
      _isOnline = false;
      await _localStorage.saveDriverOnlineStatus(false);
      _socketService.emit(SocketEvents.driverOffline, {});
      _stopLocationUpdates();
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  void _listenToSocketEvents() {
    _socketService.on(SocketEvents.newOrderOffer, (data) {
      if (data is Map<String, dynamic>) {
        _pendingOffer = Order.fromJson(data);
        notifyListeners();
      }
    });

    _socketService.on(SocketEvents.orderCancelled, (data) {
      if (_activeOrder != null) {
        _activeOrder = _activeOrder!.copyWith(status: OrderStatus.cancelled);
        notifyListeners();
      }
      _pendingOffer = null;
      notifyListeners();
    });
  }

  Future<void> acceptOrder(String orderId) async {
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.acceptOrder(orderId),
      );
      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(data['data'] as Map<String, dynamic>);
      _pendingOffer = null;
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> declineOrder(String orderId) async {
    try {
      await _apiClient.patch(ApiEndpoints.declineOrder(orderId));
      _pendingOffer = null;
      notifyListeners();
    } catch (e) {
      _pendingOffer = null;
      notifyListeners();
    }
  }

  Future<void> arrivedAtPickup() async {
    if (_activeOrder == null) return;
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.arrivedAtPickup(_activeOrder!.id),
      );
      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(data['data'] as Map<String, dynamic>);
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> startTrip() async {
    if (_activeOrder == null) return;
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.startTrip(_activeOrder!.id),
      );
      final data = response.data as Map<String, dynamic>;
      _activeOrder = Order.fromJson(data['data'] as Map<String, dynamic>);
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> completeTrip() async {
    if (_activeOrder == null) return;
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.patch(
        ApiEndpoints.completeTrip(_activeOrder!.id),
      );
      final data = response.data as Map<String, dynamic>;
      final completedOrder = Order.fromJson(
        data['data'] as Map<String, dynamic>,
      );
      _todayEarnings +=
          completedOrder.actualPrice ?? completedOrder.estimatedPrice;
      _activeOrder = null;
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> cancelOrder({String? reason}) async {
    if (_activeOrder == null) return;
    _setState(DriverProviderState.loading);
    try {
      await _apiClient.patch(
        ApiEndpoints.cancelOrder(_activeOrder!.id),
        data: {if (reason != null) 'reason': reason},
      );
      _activeOrder = null;
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  void _startLocationUpdates() {
    _locationSubscription?.cancel();
    _locationSubscription = _locationService
        .getPositionStream(
      distanceFilter: AppConfig.locationUpdateDistanceFilter,
    )
        .listen((position) {
      // Masofa filtri o'zi yetarli emas — tirbandlikda mashina 10 m
      // yurmaydi va marker yo'lovchi ekranida muzlab qoladi.
      if (_pingGate.shouldEmit(
        speedMetersPerSecond: position.speed,
        now: DateTime.now(),
      )) {
        _emitLocation(position);
      }
    });
  }

  void _stopLocationUpdates() {
    _locationSubscription?.cancel();
    _locationSubscription = null;
    _pingGate.reset();
  }

  void _emitLocation(Position position) {
    _lastKnownPosition = position;
    if (_socketService.isConnected) {
      final payload = {
        'lat': position.latitude,
        'lng': position.longitude,
        if (_activeOrder != null) 'orderId': _activeOrder!.id,
      };
      _socketService.emit(SocketEvents.driverLocation, payload);
    }

    // HTTP backup, sent whenever online (not just mid-trip) so the driver's
    // stored location stays fresh for nearby-driver matching.
    _apiClient.post(
      ApiEndpoints.updateLocation,
      data: {'lat': position.latitude, 'lng': position.longitude},
    ).then<void>(
      (_) {},
      onError: (Object e) => debugPrint('[Location] HTTP update failed: $e'),
    );
  }

  // No dedicated "my active order" endpoint exists — a driver has at most one
  // order in flight, and it's always the most recent one, so it's derived
  // from the first page of order history instead.
  Future<void> checkActiveOrder() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverOrderHistory);
      final data = response.data as Map<String, dynamic>;
      final ordersJson =
          (data['data'] as Map<String, dynamic>)['orders'] as List<dynamic>;
      final orders = ordersJson
          .map((e) => Order.fromJson(e as Map<String, dynamic>))
          .toList();
      final active = orders.where((o) => o.isActive);
      _activeOrder = active.isEmpty ? null : active.first;
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] checkActiveOrder error: $e');
    }
  }

  Future<void> loadOrderHistory() async {
    _setState(DriverProviderState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.driverOrderHistory);
      final data = response.data as Map<String, dynamic>;
      final list =
          (data['data'] as Map<String, dynamic>)['orders'] as List<dynamic>;
      _orderHistory =
          list.map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
      _setState(DriverProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(DriverProviderState.error);
    }
  }

  Future<void> loadEarnings() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverEarnings);
      final data = response.data as Map<String, dynamic>;
      final payload = data['data'] as Map<String, dynamic>;
      _todayEarnings = (payload['today'] as num?)?.toDouble() ?? 0;
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadEarnings error: $e');
    }
  }

  // GET /orders/earnings/breakdown — today/last-7-days/last-30-days
  // gross/commission/net/trip-count for the calling driver. Separate from
  // [loadEarnings]/[todayEarnings] above (which stay wired to the older
  // GET /orders/earnings, still used for the headline "today" figure).
  Future<void> loadEarningsBreakdown() async {
    try {
      final response =
          await _apiClient.get(ApiEndpoints.driverEarningsBreakdown);
      final data = response.data as Map<String, dynamic>;
      _earningsBreakdown = DriverEarningsBreakdown.fromJson(
        data['data'] as Map<String, dynamic>,
      );
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadEarningsBreakdown error: $e');
    }
  }

  // GET /driver-bonus-rules/me/progress — this driver's progress toward
  // every currently-active bonus rule.
  Future<void> loadBonusProgress() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.driverBonusProgress);
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _bonusProgress = list
          .map((e) =>
              DriverBonusProgress.fromJson(e as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadBonusProgress error: $e');
    }
  }

  // GET /ratings/driver/:userId — this driver's own rating stats (average +
  // 1..5 star breakdown). Needs the driver's *User* UUID, not the driver
  // profile id, so this loads the profile first if it isn't cached yet.
  Future<void> loadRatingStats() async {
    var userId = _driver?.userId;
    if (userId == null) {
      await loadProfile();
      userId = _driver?.userId;
    }
    if (userId == null) return;
    try {
      final response =
          await _apiClient.get(ApiEndpoints.driverRatingStats(userId));
      final data = response.data as Map<String, dynamic>;
      _ratingStats =
          DriverRatingStats.fromJson(data['data'] as Map<String, dynamic>);
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadRatingStats error: $e');
    }
  }

  /// `GET /payments/wallet` — daftardan hisoblangan qoldiq.
  ///
  /// Xato JIMGINA yutiladi va oldingi qiymat SAQLANADI: bir marta yiqilgan
  /// so'rov tufayli ekrandagi summani nolga tushirish yoki yo'q qilish
  /// haydovchida pul yo'qolgandek taassurot qoldirardi.
  Future<void> loadWalletBalance() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.paymentsWallet);
      final envelope = response.data as Map<String, dynamic>;
      final payload = envelope['data'] as Map<String, dynamic>;
      final balance = (payload['balance'] as num?)?.toDouble();
      if (balance == null) {
        throw const FormatException('wallet javobida raqamli balans yo\'q');
      }
      _walletBalance = balance;
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadWalletBalance error: $e');
    }
  }

  // POST /payments/wallet/withdraw — files a payout request against the
  // driver's wallet balance. Uses its own submitting/error flags rather than
  // the shared [state]/[error] so opening the withdraw dialog never trips
  // the full-screen loading/error UI driven by [loadOrderHistory] elsewhere
  // on the earnings screen. On success the new request is prepended to
  // [withdrawals] (matches the backend's `requestedAt DESC` ordering)
  // without needing a round-trip refetch.
  Future<bool> requestWithdrawal({
    required double amount,
    required String payoutDestination,
  }) async {
    _isSubmittingWithdrawal = true;
    _withdrawalError = null;
    notifyListeners();
    try {
      final response = await _apiClient.post(
        ApiEndpoints.walletWithdraw,
        data: {
          'amount': amount,
          'payoutDestination': payoutDestination,
        },
      );
      final data = response.data as Map<String, dynamic>;
      final withdrawal =
          WithdrawalRequest.fromJson(data['data'] as Map<String, dynamic>);
      _withdrawals = [withdrawal, ..._withdrawals];
      // Server so'rov paytida darhol ushlab qolish (DEBIT) yozadi, ya'ni
      // qoldiq SHU ZAHOTI kamayadi. Ekrandagi eski summani qoldirsak,
      // haydovchi o'sha pulni yana yechmoqchi bo'lib rad javobini olardi —
      // aynan tuzatilayotgan chalkashlikning takrori.
      _walletBalance = (_walletBalance ?? 0) - amount;
      _isSubmittingWithdrawal = false;
      notifyListeners();
      return true;
    } catch (e) {
      _withdrawalError = extractErrorMessage(e);
      _isSubmittingWithdrawal = false;
      notifyListeners();
      return false;
    }
  }

  // GET /payments/wallet/withdrawals — this driver's own withdrawal request
  // history (newest first), used to render status (pending/approved/
  // rejected/paid) below the withdraw action on the earnings screen.
  Future<void> loadWithdrawals() async {
    try {
      final response = await _apiClient.get(ApiEndpoints.walletWithdrawals);
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _withdrawals = list
          .map((e) => WithdrawalRequest.fromJson(e as Map<String, dynamic>))
          .toList();
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadWithdrawals error: $e');
    }
  }

  void clearWithdrawalError() {
    _withdrawalError = null;
    notifyListeners();
  }

  void clearPendingOffer() {
    _pendingOffer = null;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    if (_state == DriverProviderState.error) {
      _setState(DriverProviderState.idle);
    }
  }

  @override
  void dispose() {
    _stopLocationUpdates();
    _socketService.off(SocketEvents.newOrderOffer);
    _socketService.off(SocketEvents.orderCancelled);
    super.dispose();
  }
}

DriverProvider buildDriverProvider() => DriverProvider(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
      locationService: sl<LocationService>(),
      localStorage: sl<LocalStorage>(),
    );
