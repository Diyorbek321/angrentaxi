import 'package:angren_taxi/core/config/app_config.dart';
import 'package:flutter/material.dart';

/// Katalog rasmi kalitidan (`catalog/<uuid>.jpg`) to'liq URL; kalit yo'q
/// bo'lsa `null`. Backend `GET /media/<kalit>` ni ochiq va uzoq kesh bilan
/// beradi — kalit har yangi rasmda o'zgaradi.
String? catalogImageUrl(String? imageKey) =>
    imageKey == null || imageKey.isEmpty
        ? null
        : '${AppConfig.apiBaseUrl}/media/$imageKey';

/// Restoran, taom va mahsulot fotosi.
///
/// Rasm yo'q, hali yuklanmoqda yoki xato bo'lsa [placeholder] ko'rinadi —
/// karta hech qachon bo'sh to'rtburchak bo'lib qolmaydi. Rasm ekrandagi
/// o'lchamga qarab dekodlanadi (`cacheWidth`): 800 px lik foto 60 dp lik
/// kichik rasmda xotirani bekorga yemasin.
class CatalogImage extends StatelessWidget {
  const CatalogImage({
    super.key,
    required this.imageUrl,
    required this.placeholder,
    this.fit = BoxFit.cover,
  });

  final String? imageUrl;
  final Widget placeholder;
  final BoxFit fit;

  @override
  Widget build(BuildContext context) {
    final url = imageUrl;
    if (url == null) return placeholder;

    return LayoutBuilder(
      builder: (context, constraints) {
        final dpr = MediaQuery.devicePixelRatioOf(context);
        final width =
            constraints.hasBoundedWidth ? constraints.maxWidth : 400.0;
        return Stack(
          fit: StackFit.expand,
          children: [
            placeholder,
            Image.network(
              url,
              fit: fit,
              cacheWidth: (width * dpr).round().clamp(64, 1200),
              excludeFromSemantics: true,
              frameBuilder: (context, child, frame, wasSynchronouslyLoaded) {
                if (wasSynchronouslyLoaded) return child;
                return AnimatedOpacity(
                  opacity: frame == null ? 0 : 1,
                  duration: const Duration(milliseconds: 220),
                  curve: Curves.easeOut,
                  child: child,
                );
              },
              errorBuilder: (_, __, ___) => const SizedBox.shrink(),
            ),
          ],
        );
      },
    );
  }
}
