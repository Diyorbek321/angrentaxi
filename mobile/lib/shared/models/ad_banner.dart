import 'package:angren_taxi/core/config/app_config.dart';

/// Bosilganda nima ochiladi — backend'dagi `AdLinkType` bilan bir xil.
enum AdLinkType { none, restaurant, store, url }

AdLinkType adLinkTypeFromString(String? value) => switch (value) {
      'restaurant' => AdLinkType.restaurant,
      'store' => AdLinkType.store,
      'url' => AdLinkType.url,
      // Noma'lum tur (yangi backend, eski ilova) — bosilganda hech narsa
      // qilmaymiz, noto'g'ri ekranni ochishdan ko'ra yaxshiroq.
      _ => AdLinkType.none,
    };

/// Bosh ekran karuselidagi reklama banneri (`GET /ads/active`).
class AdBanner {
  const AdBanner({
    required this.id,
    required this.title,
    required this.linkType,
    this.linkTarget,
  });

  factory AdBanner.fromJson(Map<String, dynamic> json) => AdBanner(
        id: json['id'] as String,
        title: (json['title'] as String?) ?? '',
        linkType: adLinkTypeFromString(json['linkType'] as String?),
        linkTarget: json['linkTarget'] as String?,
      );

  final String id;

  /// Admin bergan nom — rasmning ekran o'quvchi uchun tavsifi.
  final String title;
  final AdLinkType linkType;
  final String? linkTarget;

  /// Rasm banner id orqali ochiladi; backend'da ochiq va uzoq keshlanadi.
  String get imageUrl => '${AppConfig.apiBaseUrl}/ads/$id/image';

  /// Tashqi havola faqat `https://` bo'lsa ochiladi — server ham shuni
  /// tekshiradi, bu yerda ikkinchi qatlam (`intent:`/`javascript:` emas).
  Uri? get externalUri {
    if (linkType != AdLinkType.url || linkTarget == null) return null;
    final uri = Uri.tryParse(linkTarget!);
    return uri != null && uri.scheme == 'https' && uri.host.isNotEmpty ? uri : null;
  }
}
