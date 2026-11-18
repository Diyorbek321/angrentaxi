import 'package:flutter/widgets.dart';

/// Davriy REST tekshiruvining har bir taktida serverga borish kerakmi.
///
/// Faol safar va kuryer kuzatuvi socket event'lariga tayanadi, davriy
/// so'rov esa — yo'qolgan event uchun ZAXIRA. Ilgari u har 10 soniyada
/// sharoitdan qat'i nazar ketardi:
///   * ilova FONDA bo'lsa — hech kim ko'rmaydi, batareya va trafik behuda;
///   * socket ULANGAN bo'lsa — event'lar odatda yetib keladi, zaxira
///     siyrakroq bo'lsa yetadi ([connectedEvery] taktda bir marta).
/// Socket uzilganda esa har takt so'raladi — o'shanda u yagona manba.
///
/// Fonda o'tkazib yuborilgan takt bo'lsa, oldingi planga qaytgandagi
/// BIRINCHI takt darhol so'raydi: ekran ochilganda holat eskirgan bo'lmasin.
class PollGate {
  PollGate({
    required bool Function() isConnected,
    this.connectedEvery = 3,
    bool Function()? isForeground,
  })  : _isConnected = isConnected,
        _isForeground = isForeground ?? _appInForeground;

  final bool Function() _isConnected;
  final bool Function() _isForeground;

  /// Socket ulangan paytda nechta taktda bir marta so'raladi.
  final int connectedEvery;

  int _skipped = 0;
  bool _missedInBackground = false;

  bool shouldPoll() {
    if (!_isForeground()) {
      _missedInBackground = true;
      return false;
    }
    if (_missedInBackground || !_isConnected()) {
      _missedInBackground = false;
      _skipped = 0;
      return true;
    }
    _skipped++;
    if (_skipped >= connectedEvery) {
      _skipped = 0;
      return true;
    }
    return false;
  }

  static bool _appInForeground() {
    try {
      final state = WidgetsBinding.instance.lifecycleState;
      // `null` — holat hali kelmagan (ishga tushish, testlar): oldingi plan.
      return state == null || state == AppLifecycleState.resumed;
    } catch (_) {
      // Binding hali yaratilmagan — xavfsiz tomonga: so'raymiz.
      return true;
    }
  }
}
