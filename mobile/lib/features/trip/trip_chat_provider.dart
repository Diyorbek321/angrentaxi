import 'package:flutter/foundation.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/shared/models/trip_message.dart';

enum TripChatState { idle, loading, success, error }

/// In-trip passenger<->driver chat for a single order.
///
/// Loads history over REST (`GET /orders/:orderId/messages`), sends messages
/// over REST (`POST /orders/:orderId/messages`), and appends messages
/// received live over the `trip:message` socket event (broadcast to the
/// `order:${orderId}` room the client already joined via
/// [SocketEvents.joinOrder] when the order became active — see
/// OrderProvider._listenToOrderEvents).
class TripChatProvider extends ChangeNotifier {
  TripChatProvider({
    required ApiClient apiClient,
    required SocketService socketService,
  })  : _apiClient = apiClient,
        _socketService = socketService;

  final ApiClient _apiClient;
  final SocketService _socketService;

  TripChatState _state = TripChatState.idle;
  String? _error;
  List<TripMessage> _messages = [];
  bool _listening = false;

  TripChatState get state => _state;
  String? get error => _error;
  List<TripMessage> get messages => List.unmodifiable(_messages);

  void _setState(TripChatState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> loadHistory(String orderId) async {
    _setState(TripChatState.loading);
    try {
      final response = await _apiClient.get(ApiEndpoints.tripMessages(orderId));
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      _messages = list
          .map((e) => TripMessage.fromJson(e as Map<String, dynamic>))
          .toList();
      _setState(TripChatState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(TripChatState.error);
    }
  }

  Future<void> sendMessage(String orderId, String body) async {
    final trimmed = body.trim();
    if (trimmed.isEmpty) return;

    try {
      final response = await _apiClient.post(
        ApiEndpoints.tripMessages(orderId),
        data: {'body': trimmed},
      );
      final data = response.data as Map<String, dynamic>;
      final message = TripMessage.fromJson(data['data'] as Map<String, dynamic>);
      if (!_messages.any((m) => m.id == message.id)) {
        _messages = [..._messages, message];
        notifyListeners();
      }
    } catch (e) {
      _error = extractErrorMessage(e);
      notifyListeners();
    }
  }

  /// Starts listening for live `trip:message` events for [orderId]. Safe to
  /// call multiple times — mirrors OrderProvider._listenToOrderEvents'
  /// on/off lifecycle pattern.
  void listen(String orderId) {
    if (_listening) return;
    _listening = true;

    _socketService.on(SocketEvents.tripMessage, (data) {
      if (data is Map) {
        final message = TripMessage.fromJson(Map<String, dynamic>.from(data));
        if (message.orderId != orderId) return;
        if (_messages.any((m) => m.id == message.id)) return;
        _messages = [..._messages, message];
        notifyListeners();
      }
    });
  }

  void stopListening() {
    if (!_listening) return;
    _listening = false;
    _socketService.off(SocketEvents.tripMessage);
  }

  void clearError() {
    _error = null;
    if (_state == TripChatState.error) {
      _setState(TripChatState.idle);
    }
  }

  @override
  void dispose() {
    stopListening();
    super.dispose();
  }
}

TripChatProvider buildTripChatProvider() => TripChatProvider(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
    );
