import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/screens/edit_profile_screen.dart';
import 'package:angren_taxi/features/passenger/screens/referral_screen.dart';
import 'package:angren_taxi/features/superapp/screens/notifications_screen.dart';
import 'package:angren_taxi/features/superapp/screens/promos_screen.dart';
import 'package:angren_taxi/features/superapp/screens/settings_screen.dart';
import 'package:angren_taxi/features/superapp/screens/support_screen.dart';
import 'package:angren_taxi/features/superapp/screens/wallet_screen.dart';
import 'package:angren_taxi/features/superapp/state/superapp_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ProfileTab extends StatelessWidget {
  const ProfileTab({super.key});

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
    if (parts.isEmpty) return 'AG';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  void _push(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => screen));
  }

  void _notImplementedYet(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Bu bo\'lim tez kunda ishga tushadi')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.currentUser;
    final name = (user?.name?.trim().isNotEmpty ?? false) ? user!.name! : 'Foydalanuvchi';
    final phone = user?.phone ?? '';
    final topPad = MediaQuery.of(context).padding.top;

    return Container(
      color: agBg,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 100),
        children: [
          Container(
            padding: EdgeInsets.fromLTRB(18, topPad + 18, 18, 26),
            decoration: const BoxDecoration(
              gradient: agHeader,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(30)),
            ),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      width: 64,
                      height: 64,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.3), width: 2),
                      ),
                      child: Text(_initials(name),
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 24)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 20)),
                          Text(phone, style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    GestureDetector(
                      onTap: () => _push(context, const EditProfileScreen()),
                      child: const Icon(Icons.edit_rounded, color: Colors.white70, size: 24),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    _stat('${user?.totalTrips ?? 0}', 'Safarlar'),
                    const SizedBox(width: 10),
                    _stat(
                      user?.rating != null ? user!.rating!.toStringAsFixed(1) : '—',
                      'Reyting',
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 18, 16, 0),
            child: Column(
              children: [
                GestureDetector(
                  onTap: () => _push(context, const SupportScreen()),
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: agInk,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [BoxShadow(color: agInk.withValues(alpha: 0.2), blurRadius: 30, offset: const Offset(0, 12))],
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 46,
                          height: 46,
                          decoration: BoxDecoration(color: agBright.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(13)),
                          child: const Icon(Icons.support_agent_rounded, color: agBright, size: 24),
                        ),
                        const SizedBox(width: 13),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Yordam kerakmi?', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                              Text("24/7 qo'llab-quvvatlash xizmati", style: TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w600)),
                            ],
                          ),
                        ),
                        const Icon(Icons.arrow_forward_rounded, color: agBright, size: 22),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      _MenuRow(icon: Icons.account_balance_wallet_rounded, iconColor: agGreen, label: 'Hamyon va kartalar',
                          onTap: () => _push(context, const WalletScreen())),
                      _MenuRow(icon: Icons.receipt_long_rounded, label: 'Buyurtmalar tarixi',
                          onTap: () => context.read<SuperappProvider>().tabIndex = 1),
                      _MenuRow(icon: Icons.favorite_rounded, label: 'Sevimlilar',
                          onTap: () => _notImplementedYet(context)),
                      _MenuRow(icon: Icons.workspace_premium_rounded, iconColor: agOrange, label: 'Bonuslar',
                          onTap: () => _notImplementedYet(context)),
                      _MenuRow(icon: Icons.reviews_rounded, label: 'Mening baholarim',
                          onTap: () => _notImplementedYet(context)),
                      _MenuRow(icon: Icons.place_rounded, label: 'Saqlangan manzillar',
                          onTap: () => _notImplementedYet(context)),
                      _MenuRow(icon: Icons.redeem_rounded, label: 'Aksiyalar va promokodlar',
                          onTap: () => _push(context, const PromosScreen())),
                      _MenuRow(icon: Icons.group_add_rounded, iconColor: agPurple, label: "Do'stlarni taklif qilish",
                          onTap: () => _push(context, const ReferralScreen())),
                      _MenuRow(icon: Icons.notifications_rounded, label: 'Bildirishnomalar',
                          onTap: () => _push(context, const NotificationsScreen())),
                      _MenuRow(icon: Icons.settings_rounded, label: 'Sozlamalar', last: true,
                          onTap: () => _push(context, const SettingsScreen())),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                GestureDetector(
                  onTap: () => auth.logout(),
                  child: Container(
                    height: 50,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: agSurface,
                      borderRadius: BorderRadius.circular(15),
                      border: Border.all(color: const Color(0xFFF1D6D6)),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.logout_rounded, size: 20, color: agRed),
                        SizedBox(width: 8),
                        Text('Chiqish', style: TextStyle(color: agRed, fontWeight: FontWeight.w800, fontSize: 14.5)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String value, String label) => Expanded(
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            children: [
              Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
              Text(label, style: const TextStyle(color: Colors.white70, fontSize: 11.5, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      );
}

class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.label,
    this.iconColor = agSubtle,
    this.onTap,
    this.last = false,
  });

  final IconData icon;
  final String label;
  final Color iconColor;
  final VoidCallback? onTap;
  final bool last;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 23, color: iconColor),
            const SizedBox(width: 13),
            Expanded(
              child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14.5, color: agText)),
            ),
            const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFFC2CCD4)),
          ],
        ),
      ),
    );
  }
}
