import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';

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
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _buildAvatar(user.displayName),
                const SizedBox(height: 20),
                Text(
                  user.displayName,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  Formatters.formatPhone(user.phone),
                  style: const TextStyle(color: kTextSecondary),
                ),
                if (user.rating != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.star, color: kPrimaryYellow, size: 18),
                      const SizedBox(width: 4),
                      Text(
                        '${Formatters.formatRating(user.rating!)} reyting',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 32),
                _buildStatsRow(user.totalTrips ?? 0),
                const SizedBox(height: 24),
                _buildMenuList(context),
                const SizedBox(height: 24),
                AppButton(
                  label: 'Chiqish',
                  onPressed: () => _confirmLogout(context, auth),
                  backgroundColor: kError,
                  foregroundColor: Colors.white,
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

    return CircleAvatar(
      radius: 48,
      backgroundColor: kPrimaryYellow,
      child: Text(
        initials.toUpperCase(),
        style: const TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: Colors.black,
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
        const SizedBox(width: 12),
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
          () {},
        ),
        _buildMenuTile(
          Icons.payment_outlined,
          'To\'lov usullari',
          () {},
        ),
        _buildMenuTile(
          Icons.notifications_outlined,
          'Bildirishnomalar',
          () {},
        ),
        _buildMenuTile(
          Icons.help_outline,
          'Yordam',
          () {},
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
      leading: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: kSurfaceGrey,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: kTextPrimary, size: 20),
      ),
      title: Text(title),
      trailing: const Icon(Icons.arrow_forward_ios, size: 16, color: kTextSecondary),
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
            child: const Text('Chiqish', style: TextStyle(color: kError)),
          ),
        ],
      ),
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
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        children: [
          Icon(icon, color: kPrimaryYellow, size: 28),
          const SizedBox(height: 8),
          Text(
            value,
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: kTextSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
