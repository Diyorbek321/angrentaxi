import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

// ============================================================================
// SKELETON — yuklanish holati.
//
// QOIDA: ro'yxat va karta yuklanayotganda spinner EMAS, skeleton ko'rsatiladi.
// Skeleton yuklanadigan kontentning SHAKLINI takrorlashi shart — shunda
// kontent kelganda layout sakramaydi.
//
// Spinner faqat: (a) tugma ichidagi inline holat, (b) shakli oldindan
// noma'lum bo'lgan qisqa amal (masalan to'lovni tasdiqlash).
//
// Kontrast: skeleton `kSurface2` (#EDF3F4) fonda `kSurface3` shimmer bilan —
// dekorativ, ma'no tashimaydi, shuning uchun 3:1 talab qilinmaydi.
// Ekran o'quvchilar uchun butun blok `Semantics(label: 'Yuklanmoqda')`.
// ============================================================================

/// Bitta shimmer to'rtburchak — barcha skeleton shakllarining qurilish bloki.
class AppSkeleton extends StatelessWidget {
  const AppSkeleton({
    super.key,
    this.width,
    this.height = 14,
    this.radius = kRadiusXs,
    this.shape = BoxShape.rectangle,
  });

  /// Doira (avatar, ikona konteyneri) uchun.
  const AppSkeleton.circle({super.key, required double size})
      : width = size,
        height = size,
        radius = kRadiusFull,
        shape = BoxShape.circle;

  final double? width;
  final double height;
  final double radius;
  final BoxShape shape;

  @override
  Widget build(BuildContext context) {
    final box = Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: kSurface2,
        shape: shape,
        borderRadius:
            shape == BoxShape.circle ? null : BorderRadius.circular(radius),
      ),
    );

    // Qulaylik (WCAG 2.3.3 / "prefers-reduced-motion"): tizimda animatsiya
    // o'chirilgan bo'lsa uzluksiz shimmer ishlatilmaydi — skeleton statik
    // qoladi. Vestibulyar buzilishlari bor foydalanuvchilar uchun muhim.
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return box;

    return box.animate(onPlay: (c) => c.repeat()).shimmer(
          duration: 1600.ms,
          color: kSurface3,
        );
  }
}

/// Ekran/blok darajasidagi skeleton o'ramasi — ekran o'quvchi uchun bitta
/// "Yuklanmoqda" e'loni beradi va ichki shimmerlarni takroran o'qimaydi.
class AppSkeletonGroup extends StatelessWidget {
  const AppSkeletonGroup({
    super.key,
    required this.child,
    this.label = 'Yuklanmoqda',
  });

  final Widget child;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: label,
      liveRegion: true,
      excludeSemantics: true,
      child: child,
    );
  }
}

/// Ro'yxat qatori skeletoni: chapda ikona/avatar, o'ngda ikki qator matn.
/// `orders_screen`, `notifications_screen`, `order_history_screen` shakliga mos.
class AppSkeletonTile extends StatelessWidget {
  const AppSkeletonTile({
    super.key,
    this.hasLeading = true,
    this.lines = 2,
    this.hasTrailing = false,
  });

  final bool hasLeading;
  final int lines;
  final bool hasTrailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasLeading) ...[
            const AppSkeleton(width: 44, height: 44, radius: kRadiusSm),
            const SizedBox(width: kSpace3),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < lines; i++) ...[
                  if (i > 0) const SizedBox(height: kSpace2),
                  AppSkeleton(
                    width: i == 0 ? 160 : 110,
                    height: i == 0 ? 14 : 11,
                  ),
                ],
              ],
            ),
          ),
          if (hasTrailing) ...[
            const SizedBox(width: kSpace3),
            const AppSkeleton(width: 56, height: 14),
          ],
        ],
      ),
    );
  }
}

/// Kartochka skeletoni: yuqorida rasm joyi, ostida sarlavha + izoh.
/// `market_screen`, `food_list_screen`, `restaurant_detail_screen` shakliga mos.
class AppSkeletonCard extends StatelessWidget {
  const AppSkeletonCard({super.key, this.imageHeight = 96});

  final double imageHeight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AppSkeleton(
            width: double.infinity,
            height: imageHeight,
            radius: kRadiusSm,
          ),
          const SizedBox(height: kSpace3),
          const AppSkeleton(width: 130, height: 14),
          const SizedBox(height: kSpace2),
          const AppSkeleton(width: 84, height: 11),
        ],
      ),
    );
  }
}

/// Bir nechta qator skeletoni — ro'yxat yuklanishining standart ko'rinishi.
class AppSkeletonList extends StatelessWidget {
  const AppSkeletonList({
    super.key,
    this.itemCount = 4,
    this.hasLeading = true,
    this.lines = 2,
    this.hasTrailing = false,
    this.padding = const EdgeInsets.symmetric(
      horizontal: kSpace4,
      vertical: kSpace3,
    ),
  });

  final int itemCount;
  final bool hasLeading;
  final int lines;
  final bool hasTrailing;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonGroup(
      child: ListView.separated(
        padding: padding,
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: itemCount,
        separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
        itemBuilder: (_, __) => AppSkeletonTile(
          hasLeading: hasLeading,
          lines: lines,
          hasTrailing: hasTrailing,
        ),
      ),
    );
  }
}

/// Ikki ustunli karta to'ri skeletoni (market / ovqat kataloglari).
class AppSkeletonGrid extends StatelessWidget {
  const AppSkeletonGrid({
    super.key,
    this.itemCount = 4,
    this.padding = const EdgeInsets.all(kSpace4),
  });

  final int itemCount;
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    return AppSkeletonGroup(
      child: GridView.builder(
        padding: padding,
        physics: const NeverScrollableScrollPhysics(),
        shrinkWrap: true,
        itemCount: itemCount,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: kSpace3,
          mainAxisSpacing: kSpace3,
          childAspectRatio: 0.78,
        ),
        itemBuilder: (_, __) => const AppSkeletonCard(),
      ),
    );
  }
}
