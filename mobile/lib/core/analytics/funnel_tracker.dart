import 'dart:async';

import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

/// Yo'lovchi voronkasi bosqichlari — backend `APP_FUNNEL_STEPS` bilan bir xil.
enum FunnelStep {
  appOpen('app_open'),
  destinationSelected('destination_selected'),
  priceShown('price_shown'),
  orderRequested('order_requested');

  const FunnelStep(this.apiValue);
  final String apiValue;
}

/// Anonim voronka (`POST /analytics/funnel`): serverga faqat bosqich nomlari
/// ketadi — foydalanuvchi, qurilma yoki sessiya id'si YO'Q. Server ularni
/// kunlik hisoblagichga qo'shadi.
///
/// Bir "sessiyada" har bosqich bir marta sanaladi (narx qayta hisoblansa ham
/// `price_shown` bitta). Sessiya — ilova ochilganidan zakaz berilguncha yoki
/// [sessionGap] harakatsizlikkacha. Yuborish yiqilsa bosqichlar keyingi
/// urinishga qoladi; analytics hech qachon asosiy oqimni to'xtatmaydi.
class FunnelTracker with WidgetsBindingObserver {
  FunnelTracker({
    required ApiClient api,
    this.app = 'passenger',
    this.sessionGap = const Duration(minutes: 30),
    this.flushDelay = const Duration(seconds: 5),
    DateTime Function()? now,
  })  : _api = api,
        _now = now ?? DateTime.now;

  final ApiClient _api;
  final String app;
  final Duration sessionGap;

  /// Bosqichlar shu vaqt yig'ilib bitta so'rovda ketadi. `null` — faqat
  /// [flush] chaqirilganda (testlar).
  final Duration? flushDelay;
  final DateTime Function() _now;

  static const int maxPending = 40;

  final Set<FunnelStep> _counted = {};
  final List<FunnelStep> _pending = [];
  DateTime? _lastActivity;
  Timer? _timer;
  Future<void>? _inFlight;

  /// Ilova hayot siklini tinglash: qaytganda [onAppResumed], fonga ketganda
  /// yig'ilganini yuborish.
  void attach() => WidgetsBinding.instance.addObserver(this);

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.resumed:
        onAppResumed();
      case AppLifecycleState.paused:
        unawaited(flush());
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.detached:
        break;
    }
  }

  /// Ilova ochildi yoki fondan qaytdi. Uzoq tanaffusdan keyin — yangi sessiya.
  void onAppResumed() => mark(FunnelStep.appOpen);

  void mark(FunnelStep step) {
    final now = _now();
    final last = _lastActivity;
    if (last == null || now.difference(last) > sessionGap) _counted.clear();
    _lastActivity = now;

    if (!_counted.add(step)) return;
    // Tarmoqsiz uzoq vaqt: eng eskilari tashlanadi, navbat cheksiz o'smaydi.
    if (_pending.length >= maxPending) _pending.removeAt(0);
    _pending.add(step);

    if (step == FunnelStep.orderRequested) {
      // Keyingi zakaz o'z voronkasini boshlaydi; ilova ochilishi esa yo'q.
      _counted.removeWhere((s) => s != FunnelStep.appOpen);
      unawaited(flush());
      return;
    }
    final delay = flushDelay;
    if (delay != null) {
      _timer?.cancel();
      _timer = Timer(delay, () => unawaited(flush()));
    }
  }

  Future<void> flush() {
    _timer?.cancel();
    // Bir vaqtda ikki so'rov ketmasin — navbatdagisi oldingisidan keyin.
    return _inFlight = (_inFlight ?? Future<void>.value()).then((_) => _send());
  }

  Future<void> _send() async {
    if (_pending.isEmpty) return;
    final batch = List<FunnelStep>.of(_pending);
    _pending.clear();
    try {
      await _api.post(
        ApiEndpoints.analyticsFunnel,
        data: {'app': app, 'steps': batch.map((s) => s.apiValue).toList()},
      );
    } catch (e) {
      // Tarmoq yo'q: keyingi safar yuboriladi (hajmi bosqichlar soni bilan cheklangan).
      _pending.insertAll(0, batch.where((s) => !_pending.contains(s)));
      debugPrint('[Funnel] yuborilmadi: $e');
    }
  }

  @visibleForTesting
  List<FunnelStep> get pendingForTest => List.unmodifiable(_pending);

  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
  }
}
