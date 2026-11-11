import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/legal/legal_acceptance_sheet.dart';
import 'package:angren_taxi/features/legal/legal_terms_service.dart';
import 'package:flutter/widgets.dart';
import 'package:provider/provider.dart';

/// Bosh ekran ochilganda oferta roziligini tekshiradi (yo'lovchi —
/// `SuperappShell`, haydovchi — `DriverHomeScreen`).
///
///   · Hozirgina OTP bilan kirildi → kirish ekranidagi "davom etish orqali
///     rozilik bildirasiz" (havolalar bilan) — kutilayotgan hujjatlar
///     `source: login` bilan yoziladi, oyna chiqmaydi.
///   · Saqlangan sessiya, tahrir o'zgargan → yopib bo'lmaydigan oyna:
///     "Qabul qilaman" yoki "Chiqish".
///
/// Har foydalanuvchi uchun ilova jarayonida BIR MARTA (ekran qayta
/// qurilsa takrorlanmaydi). Faol safar bu oyna ostida davom etadi — server
/// darvozasi faqat yangi onlayn chiqishda (haydovchi) ishlaydi.
abstract final class LegalAcceptanceGate {
  static String? _checkedUserId;

  @visibleForTesting
  static void reset() => _checkedUserId = null;

  static Future<void> check(BuildContext context, {LegalTermsService? service}) async {
    final auth = Provider.of<AuthProvider?>(context, listen: false);
    final userId = auth?.currentUser?.id;
    if (auth == null || !auth.isAuthenticated || userId == null) return;
    if (_checkedUserId == userId) return;
    final terms = service ?? _defaultService();
    if (terms == null) return;
    _checkedUserId = userId;

    if (auth.consumeJustLoggedIn()) {
      await terms.acceptPendingAtLogin();
      return;
    }
    try {
      final status = await terms.fetchStatus();
      if (status == null || !status.mustAccept || !context.mounted) return;
      await showLegalAcceptanceSheet(
        context,
        status: status,
        service: terms,
        onLogout: auth.logout,
      );
    } catch (e) {
      // Tarmoq xatosi — keyingi ochilishda qayta so'raladi.
      _checkedUserId = null;
      debugPrint('Legal acceptance check failed: $e');
    }
  }

  static LegalTermsService? _defaultService() =>
      sl.isRegistered<ApiClient>() ? LegalTermsService(sl<ApiClient>()) : null;
}
