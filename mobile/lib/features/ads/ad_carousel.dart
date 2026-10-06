import 'dart:async';

import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/features/ads/ads_service.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/ad_banner.dart';
import 'package:flutter/material.dart';

/// Karusel o'z-o'zidan keyingi bannerga o'tish oralig'i.
const Duration kAdAutoAdvance = Duration(seconds: 5);

/// Bosh ekrandagi reklama karuseli (3-versiya).
///
/// ⚠️ XATO VA BO'SH HOLATDA — HECH NARSA. Reklama yo'lovchi uchun ikkilamchi:
/// skeleton, xato kartasi yoki "reklama yo'q" yozuvi taksi va xizmatlardan
/// e'tiborni o'g'irlardi. Yuklanmagan yoki bo'sh bo'lsa vidjet joy egallamaydi.
///
/// KO'RISH qachon hisoblanadi: banner ekranda turgan sahifa VA rasmi
/// haqiqatan chizilgan bo'lsa — yuklanmay qolgan rasm reklama beruvchiga
/// "ko'rildi" deb sotilmasin. Sessiyada bir marta ([AdsService]).
class AdCarousel extends StatefulWidget {
  const AdCarousel({
    super.key,
    required this.service,
    required this.onOpen,
    this.imageFor = _networkImage,
  });

  final AdsService service;

  /// Rasm manbai. Testlarda xotiradagi rasm beriladi — `flutter test`
  /// tarmoq so'rovlarini 400 bilan qaytaradi.
  final ImageProvider Function(AdBanner banner) imageFor;

  /// Bosilgan bannerni ochish (restoran/do'kon ekrani yoki tashqi havola).
  /// Bosish hisoblagichi bu chaqiruvdan OLDIN yuboriladi.
  final void Function(AdBanner banner) onOpen;

  @override
  State<AdCarousel> createState() => _AdCarouselState();
}

ImageProvider _networkImage(AdBanner banner) => NetworkImage(banner.imageUrl);

class _AdCarouselState extends State<AdCarousel> {
  final PageController _controller = PageController();
  final Set<String> _painted = <String>{};
  List<AdBanner> _banners = const [];
  int _current = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final banners = await widget.service.active();
      if (!mounted) return;
      setState(() => _banners = banners);
      _restartTimer();
    } catch (e) {
      debugPrint('[Ads] load failed: $e');
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // "Harakatni kamaytirish" yoqilgan bo'lsa avtomatik aylanish o'chadi.
    _restartTimer();
  }

  void _restartTimer() {
    _timer?.cancel();
    if (!mounted || _banners.length < 2) return;
    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) return;
    _timer = Timer.periodic(kAdAutoAdvance, (_) {
      if (!_controller.hasClients) return;
      final next = (_current + 1) % _banners.length;
      _controller.animateToPage(
        next,
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeInOut,
      );
    });
  }

  void _maybeCountImpression() {
    if (_current >= _banners.length) return;
    final banner = _banners[_current];
    if (_painted.contains(banner.id)) widget.service.recordImpression(banner.id);
  }

  void _onPainted(AdBanner banner) {
    if (!_painted.add(banner.id)) return;
    _maybeCountImpression();
  }

  void _onTap(AdBanner banner) {
    widget.service.recordClick(banner.id);
    widget.onOpen(banner);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_banners.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: context.gutter),
      child: ResponsiveContent(
        child: Column(
          children: [
            AspectRatio(
              aspectRatio: 2,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(kRadiusLg),
                // Qo'l bilan surilganda taymer qaytadan boshlanadi — aks
                // holda foydalanuvchi o'qiyotgan banner ostidan qochib ketardi.
                child: NotificationListener<ScrollStartNotification>(
                  onNotification: (n) {
                    if (n.dragDetails != null) _restartTimer();
                    return false;
                  },
                  child: PageView.builder(
                    controller: _controller,
                    itemCount: _banners.length,
                    onPageChanged: (i) {
                      setState(() => _current = i);
                      _maybeCountImpression();
                    },
                    itemBuilder: (context, i) => _AdSlide(
                      banner: _banners[i],
                      image: widget.imageFor(_banners[i]),
                      onPainted: () => _onPainted(_banners[i]),
                      onTap: () => _onTap(_banners[i]),
                    ),
                  ),
                ),
              ),
            ),
            if (_banners.length > 1) ...[
              const SizedBox(height: kSpace2),
              _Dots(count: _banners.length, current: _current),
            ],
          ],
        ),
      ),
    );
  }
}

class _AdSlide extends StatelessWidget {
  const _AdSlide({
    required this.banner,
    required this.image,
    required this.onPainted,
    required this.onTap,
  });

  final AdBanner banner;
  final ImageProvider image;
  final VoidCallback onPainted;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tappable = banner.linkType != AdLinkType.none;
    return Semantics(
      image: true,
      button: tappable,
      label: '${context.l10n.saAdBadge}: ${banner.title}',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: tappable ? onTap : null,
        behavior: HitTestBehavior.opaque,
        child: Stack(
          fit: StackFit.expand,
          children: [
            ColoredBox(
              color: agSurface,
              child: Image(
                image: image,
                fit: BoxFit.cover,
                frameBuilder: (context, child, frame, _) {
                  if (frame != null) {
                    WidgetsBinding.instance.addPostFrameCallback((_) => onPainted());
                  }
                  return child;
                },
                // Yuklanmagan rasm — bo'sh fon; ko'rish hisoblanmaydi.
                errorBuilder: (_, __, ___) => const SizedBox.shrink(),
              ),
            ),
            // Reklama ekanligi aniq ko'rinishi shart (iste'molchi huquqi):
            // tashkiliy kontent bilan adashtirilmasin.
            Positioned(
              top: kSpace2,
              left: kSpace2,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.45),
                  borderRadius: BorderRadius.circular(kRadiusSm),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: kSpace2, vertical: 2),
                  child: Text(
                    context.l10n.saAdBadge,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: kFontCaption,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Dots extends StatelessWidget {
  const _Dots({required this.count, required this.current});

  final int count;
  final int current;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < count; i++)
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: i == current ? 16 : 6,
              height: 6,
              decoration: BoxDecoration(
                color: i == current ? agPrimary : agBorder,
                borderRadius: BorderRadius.circular(3),
              ),
            ),
        ],
      ),
    );
  }
}
