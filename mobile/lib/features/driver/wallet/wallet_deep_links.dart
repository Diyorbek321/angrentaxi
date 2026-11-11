import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';

// ============================================================================
// HAMYONNI TO'LDIRISHDAN QAYTISH — `angrengo://wallet/topup/<id>`
// (docs/LEGAL-COMPLIANCE.md §24).
//
// Plaginsiz va platforma kanalisiz: Flutter'ning o'z deep link mexanizmi
// (Android `flutter_deeplinking_enabled`, driver flavor manifesti). Havola
// ilovaga marshrut sifatida keladi:
//   · issiq start — `WidgetsBindingObserver.didPushRouteInformation`;
//   · sovuq start — boshlang'ich marshrut (`MaterialApp.onGenerateInitialRoutes`
//     da [DriverDeepLinks.handle] ga beriladi).
// Embedding versiyasiga qarab marshrut to'liq URI yoki faqat yo'l
// (`/topup/<id>`) bo'lishi mumkin — [parseWalletTopupLink] ikkalasini ham
// taniydi.
//
// ⚠️ Qaytish to'lovni TASDIQLAMAYDI — faqat to'ldirish holati ekranini
// ochadi; u `GET /payments/wallet/topup/<id>` ni so'raydi.
// ============================================================================

const String kWalletLinkScheme = 'angrengo';

final RegExp _topupId = RegExp(r'^[A-Za-z0-9_-]{1,64}$');

/// Havoladan to'ldirish id'si; bizniki bo'lmasa `null`.
///
/// Qabul qilinadi: `angrengo://wallet/topup/<id>`,
/// `https://angrengo.uz/app/wallet/topup/<id>`, `/wallet/topup/<id>` va
/// `/topup/<id>` (Flutter sxema va hostni tashlab yuborgan holat).
String? parseWalletTopupLink(String? link) {
  if (link == null) return null;
  final text = link.trim();
  if (text.isEmpty) return null;
  final Uri uri;
  try {
    uri = Uri.parse(text);
  } on FormatException {
    return null;
  }
  final segments = uri.pathSegments.where((s) => s.isNotEmpty).toList();
  final scheme = uri.scheme.toLowerCase();

  List<String>? tail;
  if (scheme == kWalletLinkScheme) {
    if (uri.host.toLowerCase() != 'wallet') return null;
    tail = segments;
  } else if (scheme == 'https') {
    final host = uri.host.toLowerCase();
    if (host != 'angrengo.uz' && host != 'www.angrengo.uz') return null;
    final i = segments.indexOf('wallet');
    if (i < 0) return null;
    tail = segments.sublist(i + 1);
  } else if (scheme.isEmpty) {
    tail = segments.isNotEmpty && segments.first == 'wallet'
        ? segments.sublist(1)
        : segments;
  } else {
    return null;
  }

  if (tail.length != 2 || tail.first != 'topup') return null;
  final id = Uri.decodeComponent(tail[1]);
  return _topupId.hasMatch(id) ? id : null;
}

/// Ilova bo'ylab yagona deep link qabul qiluvchi (haydovchi ilovasi).
///
/// [DriverPushBus] naqshi: bosh ekran [markReady] chaqirguncha havola
/// saqlab turiladi — aks holda kirish/onboarding darvozasining
/// `pushReplacementNamed` i ochilgan ekranni yo'qotardi.
class DriverDeepLinks with WidgetsBindingObserver {
  DriverDeepLinks();

  static final DriverDeepLinks instance = DriverDeepLinks();

  final StreamController<String> _controller =
      StreamController<String>.broadcast();
  String? _pending;
  bool _ready = false;
  bool _installed = false;

  /// To'ldirish id'lari.
  Stream<String> get topupLinks => _controller.stream;

  /// `runApp` dan OLDIN chaqiriladi: kuzatuvchi `WidgetsApp` dan oldin
  /// ro'yxatda turishi shart, aks holda u havolani nomli marshrut deb
  /// push qilib, "marshrut topilmadi" xatosiga tushadi.
  void install() {
    if (_installed) return;
    _installed = true;
    WidgetsBinding.instance.addObserver(this);
  }

  /// Havola bizniki bo'lsa qabul qiladi va `true` qaytaradi.
  bool handle(String? link) {
    final id = parseWalletTopupLink(link);
    if (id == null) return false;
    if (!_ready || !_controller.hasListener) {
      _pending = id;
    } else {
      _controller.add(id);
    }
    return true;
  }

  void markReady() {
    _ready = true;
    final pending = _pending;
    _pending = null;
    if (pending != null) _controller.add(pending);
  }

  @visibleForTesting
  void resetForTest() {
    _ready = false;
    _pending = null;
  }

  @override
  Future<bool> didPushRouteInformation(RouteInformation routeInformation) =>
      SynchronousFuture(handle(routeInformation.uri.toString()));
}
