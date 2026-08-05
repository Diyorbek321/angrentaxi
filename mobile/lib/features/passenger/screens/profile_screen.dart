import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/screens/edit_profile_screen.dart';
import 'package:angren_taxi/features/superapp/screens/support_screen.dart';
import 'package:angren_taxi/features/superapp/screens/wallet_screen.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class PassengerProfileScreen extends StatelessWidget {
  const PassengerProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          final user = auth.currentUser;
          if (user == null) return const SizedBox.shrink();

          return SingleChildScrollView(
            padding: const EdgeInsets.all(kSpace5),
            child: Column(
              children: [
                _buildAvatar(user.displayName),
                const SizedBox(height: kSpace5),
                Text(
                  user.displayName,
                  style: const TextStyle(
                    fontSize: kFontH1,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
                const SizedBox(height: kSpace1),
                Text(
                  Formatters.formatPhone(user.phone),
                  style: const TextStyle(color: kInkMuted),
                ),
                if (user.rating != null) ...[
                  const SizedBox(height: kSpace2),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Yorug' fonda ko'rinishi shart bo'lgan mint —
                      // kMintDeep (kMint oq ustida atigi 2.12:1).
                      const ExcludeSemantics(
                        child: Icon(Icons.star, color: kMintDeep, size: 18),
                      ),
                      const SizedBox(width: kSpace1),
                      Text(
                        '${Formatters.formatRating(user.rating!)} reyting',
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          color: kInk,
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: kSpace8),
                _buildStatsRow(user.totalTrips ?? 0),
                const SizedBox(height: kSpace6),
                _buildMenuList(context),
                const SizedBox(height: kSpace6),
                AppButton(
                  label: 'Chiqish',
                  onPressed: () => _confirmLogout(context, auth),
                  backgroundColor: kError,
                  foregroundColor: kOnPrimary,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildAvatar(String name) {
    final initials = name.isNotEmpty
        ? name.split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join()
        : '?';

    // Mint dekorativ to'ldirish — ustidagi yozuv ink (7.84:1), oq emas.
    return ExcludeSemantics(
      child: CircleAvatar(
        radius: 48,
        backgroundColor: kMint,
        child: Text(
          initials.toUpperCase(),
          style: const TextStyle(
            fontSize: kFontDisplay,
            fontWeight: FontWeight.w800,
            color: kOnMint,
          ),
        ),
      ),
    );
  }

  Widget _buildStatsRow(int totalTrips) {
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            value: totalTrips.toString(),
            label: 'Sayohatlar',
            icon: Icons.route,
          ),
        ),
        const SizedBox(width: kSpace3),
        const Expanded(
          child: _StatCard(
            value: '0',
            label: 'Bonus ball',
            icon: Icons.star_outline,
          ),
        ),
      ],
    );
  }

  Widget _buildMenuList(BuildContext context) {
    return Column(
      children: [
        _buildMenuTile(
          Icons.edit_outlined,
          'Ma\'lumotlarni tahrirlash',
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const EditProfileScreen()),
          ),
        ),
        _buildMenuTile(
          Icons.payment_outlined,
          'To\'lov usullari',
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const WalletScreen()),
          ),
        ),
        _buildMenuTile(
          Icons.notifications_outlined,
          'Bildirishnomalar',
          () => _notImplementedYet(context),
        ),
        _buildMenuTile(
          Icons.help_outline,
          'Yordam',
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const SupportScreen()),
          ),
        ),
        _buildMenuTile(
          Icons.info_outline,
          'Dastur haqida',
          () => _showAbout(context),
        ),
      ],
    );
  }

  Widget _buildMenuTile(IconData icon, String title, VoidCallback onTap) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      minVerticalPadding: kSpace2,
      leading: Container(
        width: kSpace10,
        height: kSpace10,
        decoration: BoxDecoration(
          color: kSurface2,
          borderRadius: BorderRadius.circular(kRadiusSm),
        ),
        child: Icon(icon, color: kInk, size: 20),
      ),
      title: Text(
        title,
        style: const TextStyle(fontSize: kFontBodyLg, color: kInk),
      ),
      trailing: const Icon(
        Icons.arrow_forward_ios,
        size: 16,
        color: kInkMuted,
      ),
      onTap: onTap,
    );
  }

  void _confirmLogout(BuildContext context, AuthProvider auth) {
    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Chiqishni tasdiqlang'),
        content: const Text('Hisobdan chiqmoqchimisiz?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text("Bekor qilish"),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              auth.logout();
            },
            // Yorug' fondagi xato MATNI — kErrorDeep (6.47:1).
            child: const Text('Chiqish', style: TextStyle(color: kErrorDeep)),
          ),
        ],
      ),
    );
  }

  void _notImplementedYet(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Bu bo\'lim tez kunda ishga tushadi')),
    );
  }

  void _showAbout(BuildContext context) {
    showAboutDialog(
      context: context,
      applicationName: 'Angren Taxi',
      applicationVersion: '1.0.0',
      applicationLegalese: '© 2024 Angren Taxi',
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.value,
    required this.label,
    required this.icon,
  });

  final String value;
  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        children: [
          ExcludeSemantics(child: Icon(icon, color: kMintDeep, size: 28)),
          const SizedBox(height: kSpace2),
          Text(
            value,
            style: const TextStyle(
              fontSize: kFontH1,
              fontWeight: FontWeight.w800,
              color: kInk,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: kInkMuted, fontSize: kFontCaption),
          ),
        ],
      ),
    );
  }
}
