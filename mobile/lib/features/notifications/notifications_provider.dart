import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/notification_log.dart';
import 'package:flutter/foundation.dart';

enum NotificationsProviderState { idle, loading, success, error }

/// Passenger/driver notification history, backed by
/// `GET /notifications`, `PATCH /notifications/:id/read`, and
/// `POST /notifications/read-all`
/// (backend/src/modules/notifications/notifications.controller.ts). Same
/// conventions as FavoritesProvider/OrderProvider: a ChangeNotifier
/// constructed with an injected ApiClient, built via
/// [buildNotificationsProvider] from the service locator for the app's
/// provider tree.
class NotificationsProvider extends ChangeNotifier {
  NotificationsProvider({required ApiClient apiClient})
      : _apiClient = apiClient;

  final ApiClient _apiClient;

  NotificationsProviderState _state = NotificationsProviderState.idle;
  String? _error;
  List<NotificationLog> _notifications = [];

  NotificationsProviderState get state => _state;
  String? get error => _error;
  List<NotificationLog> get notifications => List.unmodifiable(_notifications);
  int get unreadCount => _notifications.where((n) => !n.read).length;

  void _setState(NotificationsProviderState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> loadNotifications() async {
    _setState(NotificationsProviderState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.notifications);
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _notifications = list
          .map((e) => NotificationLog.fromJson(e as Map<String, dynamic>))
          .toList();
      _setState(NotificationsProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(NotificationsProviderState.error);
    }
  }

  /// Marks a single notification read. 404s (deleted / not-yet-loaded /
  /// foreign row — indistinguishable per the backend report) are swallowed
  /// like the rest of this provider's errors rather than surfaced as a
  /// blocking failure, since this is called opportunistically on tap.
  Future<void> markRead(String id) async {
    NotificationLog? existing;
    for (final n in _notifications) {
      if (n.id == id) {
        existing = n;
        break;
      }
    }
    if (existing == null || existing.read) return;

    try {
      final response =
          await _apiClient.patch(ApiEndpoints.markNotificationRead(id));
      final data = response.data as Map<String, dynamic>;
      final updated =
          NotificationLog.fromJson(data['data'] as Map<String, dynamic>);
      _notifications =
          _notifications.map((n) => n.id == id ? updated : n).toList();
      notifyListeners();
    } catch (e) {
      _error = extractErrorMessage(e);
      notifyListeners();
    }
  }

  Future<void> markAllRead() async {
    if (unreadCount == 0) return;

    try {
      await _apiClient.post(ApiEndpoints.markAllNotificationsRead);
      _notifications = _notifications
          .map((n) => n.read ? n : n.copyWith(read: true))
          .toList();
      notifyListeners();
    } catch (e) {
      _error = extractErrorMessage(e);
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    if (_state == NotificationsProviderState.error) {
      _setState(NotificationsProviderState.idle);
    }
  }
}

NotificationsProvider buildNotificationsProvider() => NotificationsProvider(
      apiClient: sl<ApiClient>(),
    );
