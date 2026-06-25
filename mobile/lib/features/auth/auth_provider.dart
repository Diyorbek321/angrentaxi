import 'package:flutter/widgets.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/shared/models/user.dart';

enum AuthState { idle, loading, otpSent, authenticated, error }

class AuthProvider extends ChangeNotifier {
  AuthProvider({
    required ApiClient apiClient,
    required LocalStorage localStorage,
    required SocketService socketService,
    required GlobalKey<NavigatorState> navigatorKey,
  }) : _apiClient = apiClient,
       _localStorage = localStorage,
       _socketService = socketService,
       _navigatorKey = navigatorKey;

  final ApiClient _apiClient;
  final LocalStorage _localStorage;
  final SocketService _socketService;
  final GlobalKey<NavigatorState> _navigatorKey;

  AuthState _state = AuthState.idle;
  String? _error;
  String? _phone;
  User? _currentUser;

  AuthState get state => _state;
  String? get error => _error;
  String? get phone => _phone;
  User? get currentUser => _currentUser;
  bool get isAuthenticated => _state == AuthState.authenticated;

  void _setState(AuthState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> initialize() async {
    final token = _localStorage.getToken();
    final user = _localStorage.getUser();
    if (token != null && user != null) {
      _currentUser = user;
      _socketService.connect(token);
      _setState(AuthState.authenticated);
    }
  }

  Future<void> sendOtp(String phone) async {
    _error = null;
    _setState(AuthState.loading);

    try {
      await _apiClient.post(
        ApiEndpoints.sendOtp,
        data: {'phone': phone},
      );
      _phone = phone;
      _setState(AuthState.otpSent);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(AuthState.error);
    }
  }

  Future<bool> verifyOtp(String code) async {
    _error = null;
    _setState(AuthState.loading);

    try {
      final response = await _apiClient.post(
        ApiEndpoints.verifyOtp,
        data: {'phone': _phone, 'code': code},
      );

      final data = response.data as Map<String, dynamic>;
      final innerData = data['data'] as Map<String, dynamic>;

      final token = innerData['accessToken'] as String;
      final userJson = innerData['user'] as Map<String, dynamic>;

      await _localStorage.saveToken(token);
      await _localStorage.saveUser(userJson);

      _currentUser = User.fromJson(userJson);
      _socketService.connect(token);

      _setState(AuthState.authenticated);
      return true;
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(AuthState.error);
      return false;
    }
  }

  Future<void> logout() async {
    try {
      await _apiClient.post(ApiEndpoints.logout);
    } catch (_) {
      // Ignore logout API errors
    } finally {
      _socketService.disconnect();
      await _localStorage.clearAll();
      _currentUser = null;
      _phone = null;
      _setState(AuthState.idle);
      // Return to the auth flow from wherever logout was triggered (home menu,
      // profile, etc.). Centralised here so every caller behaves consistently.
      _navigatorKey.currentState?.pushNamedAndRemoveUntil(
        '/phone',
        (route) => false,
      );
    }
  }

  void clearError() {
    _error = null;
    if (_state == AuthState.error) {
      _setState(AuthState.idle);
    }
  }

  void resetToIdle() {
    _error = null;
    _phone = null;
    _setState(AuthState.idle);
  }
}

AuthProvider buildAuthProvider() => AuthProvider(
  apiClient: sl<ApiClient>(),
  localStorage: sl<LocalStorage>(),
  socketService: sl<SocketService>(),
  navigatorKey: sl<GlobalKey<NavigatorState>>(),
);
