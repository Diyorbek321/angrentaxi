import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/screens/food_list_screen.dart';
import 'package:angren_taxi/features/superapp/screens/market_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';

/// Super-app launcher — premium animated home that lets the user pick a vertical.
///
/// NOTE: this screen is currently not wired into any route — `app.dart` sends
/// `/passenger/services` to `SuperappShell`, whose `HomeTab` is the live
/// launcher. Kept in sync with the real verticals so it stays usable if it is
/// routed again.
class ServicesScreen extends StatelessWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final firstName = (user?.name?.trim().isNotEmpty ?? false)
        ? user!.name!.split(' ').first
        : 'Mehmon';

    // Har bir gradient CHUQUR rangdan ink'ga o'tadi — ustidagi OQ matn
    // gradientning eng och nuqtasida ham AA'dan o'tadi (>= 5.02:1).
    // Ilgari taksi kartasi mint gradient + oq matn edi — 2.12:1.
    final services = <_Service>[
      _Service(
        icon: Icons.local_taxi_rounded,
        title: 'Taksi',
        subtitle: 'Tez va arzon',
        gradient: const [kPrimary, kInkGradientEnd],
        onTap: () => _openVertical(context, 'taxi'),
      ),
      _Service(
        icon: Icons.local_shipping_rounded,
        title: 'Yuk tashish',
        subtitle: 'Furgon, yuk mashina',
        gradient: const [kInfoDeep, kInkGradientEnd],
        onTap: () => _openVertical(context, 'cargo'),
      ),
      _Service(
        icon: Icons.restaurant_rounded,
        title: 'Ovqat',
        subtitle: 'Restoranlardan yetkazib berish',
        gradient: const [kWarningDeep, kInkGradientEnd],
        onTap: () => _push(context, const FoodListScreen()),
      ),
      _Service(
        icon: Icons.shopping_basket_rounded,
        title: 'Market',
        subtitle: 'Oziq-ovqat va kundalik',
        gradient: const [kAccentVioletDeep, kInkGradientEnd],
        onTap: () => _push(context, const MarketScreen()),
      ),
    ];

    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        child: SingleChildScrollView(
          padding:
              const EdgeInsets.fromLTRB(kSpace5, kSpace5, kSpace5, kSpace8),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // --- Header ---
              Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Salom, $firstName 👋',
                          style: const TextStyle(
                            fontSize: kFontDisplay,
                            fontWeight: FontWeight.w800,
                            color: kInk,
                            letterSpacing: -0.6,
                          ),
                        ),
                        const SizedBox(height: kSpace1),
                        const Text(
                          'Bugun nima kerak?',
                          style: TextStyle(
                            fontSize: kFontTitle,
                            color: kInkMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Semantics(
                    button: true,
                    label: 'Profil',
                    excludeSemantics: true,
                    child: GestureDetector(
                      onTap: () =>
                          Navigator.of(context).pushNamed('/passenger/profile'),
                      behavior: HitTestBehavior.opaque,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minHeight: kMinTapTarget,
                          minWidth: kMinTapTarget,
                        ),
                        child: Container(
                          width: kMinTapTarget,
                          height: kMinTapTarget,
                          decoration: BoxDecoration(
                            color: kMintTint,
                            borderRadius: BorderRadius.circular(kRadiusMd),
                          ),
                          // kMintTint yuza ustidagi ikona — kPrimary.
                          child: const Icon(Icons.person_rounded,
                              color: kPrimary),
                        ),
                      ),
                    ),
                  ),
                ],
              ).animate().fadeIn(duration: 400.ms).slideY(
                  begin: -0.25, curve: Curves.easeOutCubic),
              const SizedBox(height: kSpace6),

              // --- Promo / brand banner ---
              const _PromoBanner()
                  .animate()
                  .fadeIn(delay: 100.ms, duration: 500.ms)
                  .slideY(begin: 0.2, curve: Curves.easeOutCubic)
                  .then()
                  .shimmer(
                    delay: 600.ms,
                    duration: 1400.ms,
                    color: kOnPrimary.withValues(alpha: 0.15),
                  ),
              const SizedBox(height: kSpace6),

              const Text(
                'Xizmatlar',
                style: TextStyle(
                  fontSize: kFontH2,
                  fontWeight: FontWeight.w800,
                  color: kInk,
                ),
              ).animate().fadeIn(delay: 200.ms),
              const SizedBox(height: kSpace4),

              // --- Animated gradient service grid ---
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: kSpace4,
                crossAxisSpacing: kSpace4,
                childAspectRatio: 1.02,
                children: [
                  for (var i = 0; i < services.length; i++)
                    _ServiceCard(service: services[i])
                        .animate()
                        .fadeIn(delay: (250 + i * 90).ms, duration: 450.ms)
                        .slideY(begin: 0.25, curve: Curves.easeOutCubic)
                        .scale(
                            begin: const Offset(0.92, 0.92),
                            curve: Curves.easeOutBack),
                ],
              ),
              const SizedBox(height: kSpace6),

              _QuickLink(
                icon: Icons.receipt_long_rounded,
                label: 'Buyurtmalar tarixi',
                onTap: () =>
                    Navigator.of(context).pushNamed('/passenger/history'),
              ).animate().fadeIn(delay: 650.ms).slideX(begin: -0.1),
            ],
          ),
        ),
      ),
    );
  }

  void _openVertical(BuildContext context, String type) {
    context.read<OrderProvider>().setServiceType(type);
    Navigator.of(context).pushNamed('/passenger/home');
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }
}

class _Service {
  const _Service({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.gradient,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final List<Color> gradient;
  final VoidCallback onTap;
}

/// Deep gradient card with a press-scale micro-interaction.
class _ServiceCard extends StatefulWidget {
  const _ServiceCard({required this.service});
  final _Service service;

  @override
  State<_ServiceCard> createState() => _ServiceCardState();
}

class _ServiceCardState extends State<_ServiceCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final s = widget.service;
    return Semantics(
      button: true,
      label: '${s.title}. ${s.subtitle}',
      excludeSemantics: true,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _pressed = true),
        onTapUp: (_) => setState(() => _pressed = false),
        onTapCancel: () => setState(() => _pressed = false),
        onTap: s.onTap,
        behavior: HitTestBehavior.opaque,
        child: AnimatedScale(
          scale: _pressed ? 0.95 : 1.0,
          duration: kDurationFast,
          curve: kEaseOut,
          child: Container(
            padding: const EdgeInsets.all(kSpace5),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: s.gradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(kRadiusLg),
              boxShadow: kShadowCard,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: kOnPrimary.withValues(alpha: 0.22),
                    borderRadius: BorderRadius.circular(kRadiusMd),
                  ),
                  child: Icon(s.icon, color: kOnPrimary, size: 28),
                ),
                const Spacer(),
                Text(
                  s.title,
                  style: const TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w800,
                    color: kOnPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  s.subtitle,
                  style: TextStyle(
                    fontSize: kFontCaption,
                    color: kOnPrimary.withValues(alpha: 0.85),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PromoBanner extends StatelessWidget {
  const _PromoBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: kGradientInkColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(kRadiusLg),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Angren Super App',
                  style: TextStyle(
                    color: kOnPrimary,
                    fontSize: kFontH2,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: kSpace1 + 2),
                Text(
                  'Taksi, yuk, ovqat va market — bir ilovada',
                  style: TextStyle(
                    color: kOnPrimary.withValues(alpha: 0.7),
                    fontSize: kFontLabel,
                  ),
                ),
              ],
            ),
          ),
          // ATAYLAB SAQLANADI: "Tez xizmat" mint ikonasi va halosi —
          // to'q yuzadagi sof dekorativ brend aksenti.
          ExcludeSemantics(
            child: Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: kMint.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(kRadiusMd),
              ),
              child: const Icon(Icons.bolt_rounded, color: kMint, size: 30),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  const _QuickLink({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: kMinTapTarget),
          child: Container(
            padding: const EdgeInsets.all(kSpace4),
            decoration: BoxDecoration(
              color: kSurface,
              borderRadius: BorderRadius.circular(kRadiusMd),
              boxShadow: kShadowCard,
            ),
            child: Row(
              children: [
                Icon(icon, color: kPrimary, size: 22),
                const SizedBox(width: kSpace3),
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w600,
                    color: kInk,
                  ),
                ),
                const Spacer(),
                const Icon(Icons.chevron_right_rounded, color: kInkMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
