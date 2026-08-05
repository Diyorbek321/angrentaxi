import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/support/screens/chat_screen.dart';
import 'package:angren_taxi/shared/models/driver_rating_stats.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DriverProfileScreen extends StatefulWidget {
  const DriverProfileScreen({super.key});

  @override
  State<DriverProfileScreen> createState() => _DriverProfileScreenState();
}

class _DriverProfileScreenState extends State<DriverProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DriverProvider>().loadRatingStats();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: Consumer2<DriverProvider, AuthProvider>(
        builder: (context, driverProvider, authProvider, _) {
          final driver = driverProvider.driver;
          final user = authProvider.currentUser;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(kSpace4),
            child: Column(
              children: [
                _buildAvatar(driver?.name ?? user?.displayName ?? 'Haydovchi'),
                const SizedBox(height: kSpace4),
                Text(
                  driver?.name ?? user?.displayName ?? 'Haydovchi',
                  style: const TextStyle(
                    fontSize: kFontH1,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
                const SizedBox(height: kSpace1),
                Text(
                  Formatters.formatPhone(user?.phone ?? ''),
                  style: const TextStyle(
                    color: kInkMuted,
                    fontSize: kFontBody,
                  ),
                ),
                const SizedBox(height: kSpace1),
                if (driver != null)
                  Semantics(
                    label:
                        '${Formatters.formatRating(driver.rating)} yulduz reyting',
                    excludeSemantics: true,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Yorug' fonda ma'noli belgi — kPrimary (mint 2.12:1).
                        const Icon(Icons.star, color: kPrimary, size: 18),
                        const SizedBox(width: kSpace1),
                        Text(
                          '${Formatters.formatRating(driver.rating)} reyting',
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: kFontBody,
                            color: kInk,
                          ),
                        ),
                      ],
                    ),
                  ),
                if (driverProvider.ratingStats.count > 0) ...[
                  const SizedBox(height: kSpace4),
                  _buildRatingBreakdown(driverProvider.ratingStats),
                ],
                const SizedBox(height: kSpace6),
                if (driver != null)
                  _buildCarInfo(
                      driver.carModel, driver.carColor, driver.carNumber),
                const SizedBox(height: kSpace6),
                _buildStatsRow(
                  driver?.totalTrips ?? 0,
                  driverProvider.todayEarnings,
                ),
                const SizedBox(height: kSpace6),
                _buildMenuList(context),
                const SizedBox(height: kSpace6),
                AppButton(
                  label: 'Chiqish',
                  onPressed: () => _confirmLogout(context, authProvider),
                  // kError + oq matn 3.91:1 → kErrorDeep 6.47:1.
                  backgroundColor: kErrorDeep,
                  foregroundColor: kOnPrimary,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  // 5-row bar chart (5 stars down to 1) below the headline rating, each row
  // sized by that star count's share of the highest bucket, with the raw
  // count alongside. From GET /ratings/driver/:userId.
  Widget _buildRatingBreakdown(DriverRatingStats stats) {
    final maxCount = stats.maxBreakdownCount;
    return Container(
      key: const ValueKey('rating_breakdown'),
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${stats.count} ta baholash',
            style: const TextStyle(
              color: kInkMuted,
              fontSize: kFontCaption,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: kSpace3),
          for (var star = 5; star >= 1; star--)
            _RatingBarRow(
              star: star,
              count: stats.breakdown[star] ?? 0,
              maxCount: maxCount,
            ),
        ],
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
          backgroundColor: kInk,
          child: Text(
            initials.toUpperCase(),
            style: const TextStyle(
              fontSize: kFontDisplay,
              fontWeight: FontWeight.w800,
              // Mint qorong'i yuzada ishlaydi (kInk ustida yuqori kontrast).
              color: kMint,
            ),
          ),
        ),
        // Onlayn indikatori — yorug' fonda ko'rinishi shart, kMintDeep.
        const ExcludeSemantics(
          child: SizedBox(
            width: 20,
            height: 20,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: kMintDeep,
                shape: BoxShape.circle,
                border: Border.fromBorderSide(
                  BorderSide(color: kSurface, width: 2),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCarInfo(String model, String color, String number) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Row(
        children: [
          const ExcludeSemantics(
            child: Icon(Icons.directions_car, color: kPrimary, size: 32),
          ),
          const SizedBox(width: kSpace3),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '$color $model',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: kFontBodyLg,
                  color: kInk,
                ),
              ),
              Text(
                number,
                style: const TextStyle(
                  color: kInkMuted,
                  fontSize: kFontLabel,
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
        const SizedBox(width: kSpace3),
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
        _buildMenuTile(
            Icons.directions_car_outlined, 'Mashina ma\'lumotlari', () {}),
        _buildMenuTile(Icons.account_balance_outlined, 'Bank hisobi', () {}),
        _buildMenuTile(Icons.notifications_outlined, 'Bildirishnomalar', () {}),
        _buildMenuTile(
          Icons.help_outline,
          'Yordam',
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const ChatScreen()),
          ),
        ),
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
          color: kSurface2,
          borderRadius: BorderRadius.circular(kRadiusSm),
        ),
        child: Icon(icon, color: kInk, size: 20),
      ),
      title: Text(
        title,
        style: const TextStyle(fontSize: kFontBody, color: kInk),
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
            child: const Text('Bekor qilish'),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              auth.logout();
            },
            child: const Text('Chiqish', style: TextStyle(color: kErrorDeep)),
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
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface2,
        borderRadius: BorderRadius.circular(kRadiusMd),
      ),
      child: Column(
        children: [
          ExcludeSemantics(child: Icon(icon, color: kPrimary, size: 28)),
          const SizedBox(height: kSpace2),
          Text(
            value,
            style: const TextStyle(
              fontSize: kFontH2,
              fontWeight: FontWeight.w800,
              color: kInk,
            ),
          ),
          Text(
            label,
            style: const TextStyle(color: kInkMuted, fontSize: kFontMicro),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// One row of the rating breakdown bar chart: "5 ★ [====----] 12".
class _RatingBarRow extends StatelessWidget {
  const _RatingBarRow({
    required this.star,
    required this.count,
    required this.maxCount,
  });

  final int star;
  final int count;
  final int maxCount;

  @override
  Widget build(BuildContext context) {
    final fraction = maxCount > 0 ? count / maxCount : 0.0;
    return Padding(
      key: ValueKey('rating_bar_row_$star'),
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Semantics(
            label: '$star yulduz',
            excludeSemantics: true,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                SizedBox(
                  width: 20,
                  child: Text(
                    '$star',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: kFontCaption,
                      color: kInk,
                    ),
                  ),
                ),
                const Icon(Icons.star, color: kPrimary, size: 12),
              ],
            ),
          ),
          const SizedBox(width: kSpace2),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(kRadiusXs),
              child: LinearProgressIndicator(
                value: fraction,
                minHeight: 8,
                backgroundColor: kSurface,
                // Progress = interaktiv qatlam → kPrimary.
                valueColor: const AlwaysStoppedAnimation<Color>(kPrimary),
              ),
            ),
          ),
          const SizedBox(width: kSpace2),
          SizedBox(
            width: 24,
            child: Text(
              '$count',
              key: ValueKey('rating_bar_count_$star'),
              textAlign: TextAlign.end,
              style: const TextStyle(color: kInkMuted, fontSize: kFontCaption),
            ),
          ),
        ],
      ),
    );
  }
}
