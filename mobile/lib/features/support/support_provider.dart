import 'package:flutter/foundation.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/socket/socket_service.dart';
import 'package:angren_taxi/shared/models/support_message.dart';
import 'package:angren_taxi/shared/models/support_thread.dart';

enum SupportProviderState { idle, loading, success, error }

class SupportProvider extends ChangeNotifier {
  SupportProvider(
      {required ApiClient apiClient, required SocketService socketService})
      : _apiClient = apiClient,
        _socketService = socketService;

  final ApiClient _apiClient;
  final SocketService _socketService;

  SupportProviderState _state = SupportProviderState.idle;
  String? _error;
  SupportThread? _thread;
  List<SupportMessage> _messages = [];
  bool _listening = false;

  SupportProviderState get state => _state;
  String? get error => _error;
  SupportThread? get thread => _thread;
  List<SupportMessage> get messages => List.unmodifiable(_messages);

  void _setState(SupportProviderState state) {
    _state = state;
    notifyListeners();
  }

  Future<void> loadThread() async {
    _setState(SupportProviderState.loading);
    try {
      final threadResponse = await _apiClient.get(ApiEndpoints.supportThreadMe);
      final threadData = threadResponse.data as Map<String, dynamic>;
      _thread =
          SupportThread.fromJson(threadData['data'] as Map<String, dynamic>);

      final messagesResponse = await _apiClient.get(
        ApiEndpoints.supportThreadMessages(_thread!.id),
      );
      final messagesData = messagesResponse.data as Map<String, dynamic>;
      final list = (messagesData['data'] as Map<String, dynamic>)['messages']
          as List<dynamic>;
      _messages = list
          .map((e) => SupportMessage.fromJson(e as Map<String, dynamic>))
          .toList();

      _listenForUpdates();
      _setState(SupportProviderState.success);
    } catch (e) {
      _error = extractErrorMessage(e);
      _setState(SupportProviderState.error);
    }
  }

  void _listenForUpdates() {
    if (_listening) return;
    _listening = true;

    _socketService.on(SocketEvents.supportMessageNew, (data) {
      if (data is Map) {
        final message =
            SupportMessage.fromJson(Map<String, dynamic>.from(data));
        if (message.threadId != _thread?.id) return;
        if (_messages.any((m) => m.id == message.id)) return;
        _messages = [..._messages, message];
        notifyListeners();
      }
    });

    _socketService.on(SocketEvents.supportThreadUpdated, (data) {
      if (data is Map && _thread != null) {
        final updated = Map<String, dynamic>.from(data);
        if (updated['id'] != _thread!.id) return;
        _thread = SupportThread.fromJson(updated);
        notifyListeners();
      }
    });
  }

  Future<void> sendMessage(String body) async {
    final thread = _thread;
    if (thread == null || body.trim().isEmpty) return;

    try {
      if (_socketService.isConnected) {
        _socketService.emit(SocketEvents.supportMessageSend, {
          'threadId': thread.id,
          'body': body.trim(),
        });
      } else {
        final response = await _apiClient.post(
          ApiEndpoints.supportThreadMessages(thread.id),
          data: {'body': body.trim()},
        );
        final data = response.data as Map<String, dynamic>;
        final message =
            SupportMessage.fromJson(data['data'] as Map<String, dynamic>);
        if (!_messages.any((m) => m.id == message.id)) {
          _messages = [..._messages, message];
          notifyListeners();
        }
      }
    } catch (e) {
      _error = extractErrorMessage(e);
      notifyListeners();
    }
  }

  Future<void> markRead() async {
    final thread = _thread;
    if (thread == null) return;
    try {
      await _apiClient.patch(ApiEndpoints.markSupportThreadRead(thread.id));
    } catch (_) {
      // Best-effort — failing to mark read shouldn't disrupt the chat.
    }
  }

  void clearError() {
    _error = null;
    if (_state == SupportProviderState.error) {
      _setState(SupportProviderState.idle);
    }
  }

  @override
  void dispose() {
    if (_listening) {
      _socketService.off(SocketEvents.supportMessageNew);
      _socketService.off(SocketEvents.supportThreadUpdated);
    }
    super.dispose();
  }
}

SupportProvider buildSupportProvider() => SupportProvider(
      apiClient: sl<ApiClient>(),
      socketService: sl<SocketService>(),
    );
