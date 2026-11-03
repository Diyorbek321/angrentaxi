import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/features/safety/contact_relay_service.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Terish oynasini ochadi — testlarda almashtiriladi.
typedef DialLauncher = Future<bool> Function(Uri uri);

Future<bool> _defaultDial(Uri uri) async {
  if (!await canLaunchUrl(uri)) return false;
  return launchUrl(uri);
}

/// Testlar uchun almashtiriladigan bog'lanishlar.
class CallRelay {
  static ContactRelayService Function() service = () => ContactRelayService(sl<ApiClient>());
  static DialLauncher dial = _defaultDial;
}

/// Buyurtma qarshi tomoniga ilova orqali qo'ng'iroq (INCIDENT-POLICY §4).
///
/// Raqam serverdan shu lahzada olinadi (faol buyurtma, ishtirokchi), keyin
/// tizim terish oynasi. Xato bo'lsa — serverning tarjima qilingan xabari
/// (masalan "Qo'ng'iroq faqat faol buyurtma davomida mumkin") yoki umumiy matn.
Future<void> callViaRelay(BuildContext context, String orderId) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  final failed = context.l10n.safetyCallFailed;
  try {
    final phone = await CallRelay.service().counterpartyPhone(orderId);
    final ok = await CallRelay.dial(Uri(scheme: 'tel', path: phone));
    if (!ok) messenger?.showSnackBar(SnackBar(content: Text(failed)));
  } catch (error) {
    final message = ApiError.from(error)?.message;
    messenger?.showSnackBar(
      SnackBar(content: Text(message == null || message.isEmpty ? failed : message)),
    );
  }
}
