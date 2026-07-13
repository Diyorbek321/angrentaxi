import 'dart:async';
import 'dart:io';
import 'package:dio/dio.dart' show MultipartFile, FormData;
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/location/location_service.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/shared/models/driver.dart';
import 'package:angren_taxi/shared/models/driver_document.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/withdrawal_request.dart';

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
  List<WithdrawalRequest> _withdrawals = [];
  bool _isSubmittingWithdrawal = false;
  String? _withdrawalError;

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
  List<WithdrawalRequest> get withdrawals => List.unmodifiable(_withdrawals);
  bool get isSubmittingWithdrawal => _isSubmittingWithdrawal;
  String? get withdrawalError => _withdrawalError;

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

  void _setState(DriverProviderState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> initialize() async {
    _isOnline = _localStorage.getDriverOnlineStatus();
    await loadProfile();
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
      _emitLocation(position);
    });
  }

  void _stopLocationUpdates() {
    _locationSubscription?.cancel();
    _locationSubscription = null;
  }

  void _emitLocation(Position position) {
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
      _todayEarnings = (data['data']['today'] as num?)?.toDouble() ?? 0;
      notifyListeners();
    } catch (e) {
      debugPrint('[DriverProvider] loadEarnings error: $e');
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
