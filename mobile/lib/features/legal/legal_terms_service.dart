import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/legal/legal_status.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

/// Hujjatning ommaviy sahifasi (backend `GET /legal/<document>`) — joriy tilda.
Uri legalDocumentUri(String document) => Uri.parse(
      '${AppConfig.apiBaseUrl}/legal/$document?lang=${AppL10n.localeName == 'ru' ? 'ru' : 'uz'}',
    );

/// Matnni brauzerda ochadi — maxfiylik siyosati bilan bir xil yo'l
/// (`account_legal_actions.dart`): havola WebView allowlist'iga bog'liq
/// bo'lmasin va foydalanuvchi uni saqlay olsin.
Future<void> openLegalDocument(String document) =>
    launchUrl(legalDocumentUri(document), mode: LaunchMode.externalApplication);

/// Hujjat nomi joriy tilda.
String legalDocumentTitle(AppLocalizations l10n, String document) =>
    switch (document) {
      LegalDocumentCode.driverTerms => l10n.ofrDriverTermsLink,
      LegalDocumentCode.vendorTerms => l10n.ofrVendorTermsLink,
      LegalDocumentCode.privacy => l10n.ofrPrivacyLink,
      _ => l10n.ofrTermsLink,
    };

/// Ilova turiga mos asosiy oferta (kirish ekranidagi havola).
String primaryTermsDocument(AppFlavor flavor) => flavor == AppFlavor.driver
    ? LegalDocumentCode.driverTerms
    : LegalDocumentCode.terms;

/// `GET/POST /legal/acceptance`.
class LegalTermsService {
  LegalTermsService(this._api);

  final ApiClient _api;

  Future<LegalStatus?> fetchStatus() async {
    final response = await _api.get(ApiEndpoints.legalAcceptance);
    return LegalStatus.tryParse(response.data);
  }

  /// Ro'yxatdagi hujjatlarning AYNAN shu versiyalarini qabul qiladi.
  /// Server versiya eskirgan bo'lsa 409 `LEGAL_VERSION_OUTDATED` beradi —
  /// chaqiruvchi holatni qayta yuklashi kerak.
  Future<LegalStatus?> accept(
    List<LegalDocumentState> documents, {
    String source = 'sheet',
  }) async {
    final response = await _api.post(
      ApiEndpoints.legalAcceptance,
      data: {
        'source': source,
        'items': [
          for (final d in documents) {'document': d.document, 'version': d.version},
        ],
      },
    );
    return LegalStatus.tryParse(response.data);
  }

  /// Kirish ekrani: "Davom etish orqali ... rozilik bildirasiz" (havolalar
  /// bilan). Kirish muvaffaqiyatli bo'lgach, kutilayotgan hujjatlar shu
  /// rozilik sifatida yoziladi. Xato bo'lsa — jim: keyingi ochilishda
  /// rozilik oynasi baribir chiqadi.
  Future<void> acceptPendingAtLogin() async {
    try {
      final status = await fetchStatus();
      final pending = status?.pending ?? const <LegalDocumentState>[];
      if (pending.isEmpty) return;
      await accept(pending, source: 'login');
    } catch (e) {
      debugPrint('Legal acceptance at login failed: $e');
    }
  }
}
