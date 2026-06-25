import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';

class DriverProfileScreen extends StatelessWidget {
  const DriverProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: Consumer2<DriverProvider, AuthProvider>(
        builder: (context, driverProvider, authProvider, _) {
          final driver = driverProvider.driver;
          final user = authProvider.currentUser;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                _buildAvatar(driver?.name ?? user?.displayName ?? 'Haydovchi'),
                const SizedBox(height: 16),
                Text(
                  driver?.name ?? user?.displayName ?? 'Haydovchi',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  Formatters.formatPhone(user?.phone ?? ''),
                  style: const TextStyle(color: kTextSecondary),
                ),
                const SizedBox(height: 4),
                if (driver != null)
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.star, color: kPrimaryYellow, size: 18),
                      const SizedBox(width: 4),
                      Text(
                        '${Formatters.formatRating(driver.rating)} reyting',
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                    ],
                  ),
                const SizedBox(height: 24),
                if (driver != null) _buildCarInfo(driver.carModel, driver.carColor, driver.carNumber),
                const SizedBox(height: 24),
                _buildStatsRow(
                  driver?.totalTrips ?? 0,
                  driverProvider.todayEarnings,
                ),
                const SizedBox(height: 24),
                _buildMenuList(context),
                const SizedBox(height: 24),
                AppButton(
                  label: 'Chiqish',
                  onPressed: () => _confirmLogout(context, authProvider),
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
        : 'H';

    return Stack(
      alignment: Alignment.bottomRight,
      children: [
        CircleAvatar(
          radius: 48,
          backgroundColor: kSecondaryBlack,
          child: Text(
            initials.toUpperCase(),
            style: const TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              color: kPrimaryYellow,
            ),
          ),
        ),
        Container(
          width: 20,
          height: 20,
          decoration: const BoxDecoration(
            color: kSuccess,
            shape: BoxShape.circle,
            border: Border.fromBorderSide(
              BorderSide(color: Colors.white, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCarInfo(String model, String color, String number) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kSurfaceGrey,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          const Icon(Icons.directions_car, color: kPrimaryYellow, size: 32),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$color $model',
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
              Text(
                number,
                style: const TextStyle(
                  color: kTextSecondary,
                  fontSize: 13,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow(int totalTrips, double todayEarnings) {
    return Row(
      children: [
        Expanded(
          child: _StatCard(
            value: totalTrips.toString(),
            label: 'Jami safarlar',
            icon: Icons.route,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatCard(
            value: Formatters.formatPriceCompact(todayEarnings),
            label: "Bugun",
            icon: Icons.account_balance_wallet_outlined,
          ),
        ),
      ],
    );
  }

  Widget _buildMenuList(BuildContext context) {
    return Column(
      children: [
        _buildMenuTile(Icons.edit_outlined, 'Ma\'lumotlarni tahrirlash', () {}),
        _buildMenuTile(Icons.directions_car_outlined, 'Mashina ma\'lumotlari', () {}),
        _buildMenuTile(Icons.account_balance_outlined, 'Bank hisobi', () {}),
        _buildMenuTile(Icons.notifications_outlined, 'Bildirishnomalar', () {}),
        _buildMenuTile(Icons.help_outline, 'Yordam', () {}),
        _buildMenuTile(
          Icons.info_outline,
          'Dastur haqida',
          () => showAboutDialog(
            context: context,
            applicationName: 'Angren Taxi - Haydovchi',
            applicationVersion: '1.0.0',
          ),
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
      trailing: const Icon(
        Icons.arrow_forward_ios,
        size: 16,
        color: kTextSecondary,
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
            child: const Text('Bekor qilish'),
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
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: kTextSecondary, fontSize: 11),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
