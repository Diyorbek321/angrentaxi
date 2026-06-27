import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';

/// Super-app launcher — premium animated home that lets the user pick a vertical.
class ServicesScreen extends StatelessWidget {
  const ServicesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().currentUser;
    final firstName = (user?.name?.trim().isNotEmpty ?? false)
        ? user!.name!.split(' ').first
        : 'Mehmon';

    final services = <_Service>[
      _Service(
        icon: Icons.local_taxi_rounded,
        title: 'Taksi',
        subtitle: 'Tez va arzon',
        gradient: const [Color(0xFF1FCA8E), Color(0xFF12A877)],
        onTap: () => _openVertical(context, 'taxi'),
      ),
      _Service(
        icon: Icons.local_shipping_rounded,
        title: 'Yuk tashish',
        subtitle: 'Furgon, yuk mashina',
        gradient: const [Color(0xFF3B82F6), Color(0xFF2563EB)],
        onTap: () => _openVertical(context, 'cargo'),
      ),
      _Service(
        icon: Icons.restaurant_rounded,
        title: 'Ovqat',
        subtitle: 'Tez kunda',
        gradient: const [Color(0xFFFB923C), Color(0xFFF59E0B)],
        comingSoon: true,
        onTap: () => _comingSoon(context),
      ),
      _Service(
        icon: Icons.shopping_basket_rounded,
        title: 'Market',
        subtitle: 'Tez kunda',
        gradient: const [Color(0xFFA78BFA), Color(0xFF8B5CF6)],
        comingSoon: true,
        onTap: () => _comingSoon(context),
      ),
    ];

    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 28),
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
                            fontSize: 25,
                            fontWeight: FontWeight.w800,
                            color: kTextPrimary,
                            letterSpacing: -0.6,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Bugun nima kerak?',
                          style: TextStyle(fontSize: 15, color: kTextSecondary),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () =>
                        Navigator.of(context).pushNamed('/passenger/profile'),
                    child: Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: kPrimaryLight,
                        borderRadius: BorderRadius.circular(kRadiusMd),
                      ),
                      child: const Icon(Icons.person_rounded, color: kPrimaryDark),
                    ),
                  ),
                ],
              ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.25, curve: Curves.easeOutCubic),
              const SizedBox(height: 22),

              // --- Promo / brand banner ---
              _PromoBanner()
                  .animate()
                  .fadeIn(delay: 100.ms, duration: 500.ms)
                  .slideY(begin: 0.2, curve: Curves.easeOutCubic)
                  .then()
                  .shimmer(delay: 600.ms, duration: 1400.ms, color: Colors.white24),
              const SizedBox(height: 26),

              const Text(
                'Xizmatlar',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: kTextPrimary,
                ),
              ).animate().fadeIn(delay: 200.ms),
              const SizedBox(height: 14),

              // --- Animated gradient service grid ---
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 14,
                crossAxisSpacing: 14,
                childAspectRatio: 1.02,
                children: [
                  for (var i = 0; i < services.length; i++)
                    _ServiceCard(service: services[i])
                        .animate()
                        .fadeIn(delay: (250 + i * 90).ms, duration: 450.ms)
                        .slideY(begin: 0.25, curve: Curves.easeOutCubic)
                        .scale(begin: const Offset(0.92, 0.92), curve: Curves.easeOutBack),
                ],
              ),
              const SizedBox(height: 24),

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

  void _comingSoon(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Bu xizmat tez kunda ishga tushadi 🚀'),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

class _Service {
  const _Service({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.gradient,
    required this.onTap,
    this.comingSoon = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final List<Color> gradient;
  final VoidCallback onTap;
  final bool comingSoon;
}

/// Vibrant gradient card with a press-scale micro-interaction.
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
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      onTap: s.onTap,
      child: AnimatedScale(
        scale: _pressed ? 0.95 : 1.0,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: s.gradient,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(kRadiusLg),
            boxShadow: [
              BoxShadow(
                color: s.gradient.last.withValues(alpha: 0.35),
                blurRadius: 18,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 50,
                height: 50,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(kRadiusMd),
                ),
                child: Icon(s.icon, color: Colors.white, size: 28),
              ),
              const Spacer(),
              Row(
                children: [
                  Flexible(
                    child: Text(
                      s.title,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  if (s.comingSoon) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'tez',
                        style: TextStyle(fontSize: 10, color: Colors.white),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 2),
              Text(
                s.subtitle,
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PromoBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F1B22), Color(0xFF1F3A34)],
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
              children: const [
                Text(
                  'Angren Super App',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 6),
                Text(
                  'Taksi, yuk, ovqat va market — bir ilovada',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: kPrimary.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(kRadiusMd),
            ),
            child: const Icon(Icons.bolt_rounded, color: kPrimary, size: 30),
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(kRadiusMd),
          boxShadow: [
            BoxShadow(
              color: kInk.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Icon(icon, color: kPrimaryDark, size: 22),
            const SizedBox(width: 12),
            Text(
              label,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w600,
                color: kTextPrimary,
              ),
            ),
            const Spacer(),
            const Icon(Icons.chevron_right_rounded, color: kTextSecondary),
          ],
        ),
      ),
    );
  }
}
