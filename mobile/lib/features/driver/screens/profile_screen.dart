import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/features/driver/screens/driver_amenities_screen.dart';
import 'package:angren_taxi/features/driver/screens/earnings_screen.dart';
import 'package:angren_taxi/features/driver/screens/vehicle_change_screen.dart';
import 'package:angren_taxi/features/lost_items/screens/lost_items_screen.dart';
import 'package:angren_taxi/features/passenger/screens/edit_profile_screen.dart';
import 'package:angren_taxi/features/superapp/screens/notifications_screen.dart';
import 'package:angren_taxi/features/support/screens/chat_screen.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/driver_rating_stats.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/language_picker.dart';
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
      appBar: AppBar(title: Text(context.l10n.drvProfileTitle)),
      body: Consumer2<DriverProvider, AuthProvider>(
        builder: (context, driverProvider, authProvider, _) {
          final driver = driverProvider.driver;
          final user = authProvider.currentUser;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(kSpace4),
            child: Column(
              children: [
                _buildAvatar(driver?.name ?? user?.displayName ?? context.l10n.drvDriver),
                const SizedBox(height: kSpace4),
                Text(
                  driver?.name ?? user?.displayName ?? context.l10n.drvDriver,
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
                    label: context.l10n.drvRatingStarsSem(
                      Formatters.formatRating(driver.rating),
                    ),
                    excludeSemantics: true,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        // Yorug' fonda ma'noli belgi — kPrimary (mint 2.12:1).
                        const Icon(Icons.star, color: kPrimary, size: 18),
                        const SizedBox(width: kSpace1),
                        Text(
                          context.l10n.drvRatingValue(
                            Formatters.formatRating(driver.rating),
                          ),
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
                  label: context.l10n.drvLogout,
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
            context.l10n.drvRatingsCount(stats.count),
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
            label: context.l10n.drvTotalTrips,
            icon: Icons.route,
          ),
        ),
        const SizedBox(width: kSpace3),
        Expanded(
          child: _StatCard(
            value: Formatters.formatPriceCompact(todayEarnings),
            label: context.l10n.drvToday,
            icon: Icons.account_balance_wallet_outlined,
          ),
        ),
      ],
    );
  }

  /// Read-only summary of the registered vehicle.
  ///
  /// There is no self-service vehicle-edit endpoint — the car is verified
  /// during onboarding and a change has to be re-approved — so this shows what
  /// is on file and points at support rather than pretending to be editable.
  void _showCarDetails(BuildContext context) {
    final driver = context.read<DriverProvider>().driver;

    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                context.l10n.drvCarDetails,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 16),
              if (driver == null)
                Text(context.l10n.drvDataNotLoaded)
              else ...[
                _carRow(context.l10n.drvCarModel, driver.carModel),
                _carRow(context.l10n.drvCarColor, driver.carColor),
                _carRow(context.l10n.drvPlateNumber, driver.carNumber),
                if (driver.carYear != null)
                  _carRow(context.l10n.drvCarYear, '${driver.carYear}'),
              ],
              const SizedBox(height: 16),
              // Tasdiqlangan haydovchi mashinani faqat so'rov orqali
              // almashtiradi — menejer tekshirmaguncha eski mashina qoladi.
              AppButton(
                label: context.l10n.drvVehicleChangeTitle,
                icon: const Icon(Icons.swap_horiz_rounded),
                onPressed: () {
                  Navigator.of(sheetContext).pop();
                  Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => VehicleChangeScreen(current: driver),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _carRow(String label, String value) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 6),
    child: Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.black54)),
        Text(
          value.isEmpty ? '—' : value,
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ],
    ),
  );

  Widget _buildMenuList(BuildContext context) {
    return Column(
      children: [
        // These four were `() {}` — no navigation, no snackbar, nothing at
        // all. "Bank hisobi" in particular meant a driver could not set a
        // payout destination from the app, so they had no way to get paid.
        _buildMenuTile(
          Icons.edit_outlined,
          context.l10n.drvEditProfile,
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const EditProfileScreen()),
          ),
        ),
        _buildMenuTile(
          Icons.directions_car_outlined,
          context.l10n.drvCarDetails,
          () => _showCarDetails(context),
        ),
        _buildMenuTile(
          Icons.tune_rounded,
          context.l10n.drvAmenitiesTitle,
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const DriverAmenitiesScreen()),
          ),
        ),
        _buildMenuTile(
          Icons.account_balance_outlined,
          context.l10n.drvBankAndWithdraw,
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const EarningsScreen()),
          ),
        ),
        _buildMenuTile(
          Icons.language_rounded,
          '${context.l10n.appLanguage}: '
          '${languageName(context, currentAppLocale(context))}',
          () => showLanguagePicker(context),
        ),
        _buildMenuTile(
          Icons.inventory_2_outlined,
          context.l10n.drvLostItems,
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const LostItemsScreen(isDriver: true),
            ),
          ),
        ),
        _buildMenuTile(
          Icons.notifications_outlined,
          context.l10n.drvNotifications,
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const NotificationsScreen()),
          ),
        ),
        _buildMenuTile(
          Icons.help_outline,
          context.l10n.drvHelp,
          () => Navigator.of(context).push(
            MaterialPageRoute<void>(builder: (_) => const ChatScreen()),
          ),
        ),
        _buildMenuTile(
          Icons.info_outline,
          context.l10n.drvAbout,
          () => showAboutDialog(
            context: context,
            applicationName: context.l10n.drvAppName,
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
        title: Text(context.l10n.drvLogoutConfirmTitle),
        content: Text(context.l10n.drvLogoutConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(context.l10n.drvCancel),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              auth.logout();
            },
            child: Text(
              context.l10n.drvLogout,
              style: const TextStyle(color: kErrorDeep),
            ),
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
            label: context.l10n.drvRateStars(star),
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
