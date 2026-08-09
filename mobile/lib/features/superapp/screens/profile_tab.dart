import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/features/passenger/screens/destination_screen.dart';
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
            padding: EdgeInsets.fromLTRB(kSpace4, topPad + kSpace5, kSpace4, kSpace6),
            decoration: const BoxDecoration(
              gradient: agHeader,
              borderRadius: BorderRadius.vertical(bottom: Radius.circular(kRadiusXl)),
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
                        color: agSurface.withValues(alpha: 0.22),
                        borderRadius: BorderRadius.circular(kRadiusLg),
                        border: Border.all(
                            color: agSurface.withValues(alpha: 0.3), width: 2),
                      ),
                      child: Text(_initials(name),
                          style: const TextStyle(
                              color: agOnPrimary,
                              fontWeight: FontWeight.w800,
                              fontSize: kFontH1)),
                    ),
                    const SizedBox(width: kSpace4),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  color: agOnPrimary,
                                  fontWeight: FontWeight.w800,
                                  fontSize: kFontH2)),
                          Text(phone,
                              style: const TextStyle(
                                  color: agOnPrimary,
                                  fontSize: kFontLabel,
                                  fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    Semantics(
                      button: true,
                      label: 'Profilni tahrirlash',
                      excludeSemantics: true,
                      child: GestureDetector(
                        onTap: () => _push(context, const EditProfileScreen()),
                        behavior: HitTestBehavior.opaque,
                        child: const SizedBox(
                          width: kMinTapTarget,
                          height: kMinTapTarget,
                          child: Icon(Icons.edit_rounded, color: agOnPrimary, size: 24),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: kSpace5),
                Row(
                  children: [
                    _stat('${user?.totalTrips ?? 0}', 'Safarlar'),
                    const SizedBox(width: kSpace3),
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
            padding: const EdgeInsets.fromLTRB(kSpace4, kSpace5, kSpace4, 0),
            child: Column(
              children: [
                Semantics(
                  button: true,
                  label: "Yordam kerakmi? 24/7 qo'llab-quvvatlash xizmati",
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: () => _push(context, const SupportScreen()),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.all(kSpace4),
                      decoration: BoxDecoration(
                        color: agInk,
                        borderRadius: BorderRadius.circular(kRadiusLg),
                        boxShadow: agInkShadow,
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 46,
                            height: 46,
                            decoration: BoxDecoration(
                                color: agBright.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(kRadiusSm)),
                            child: const Icon(Icons.support_agent_rounded,
                                color: agBright, size: 24),
                          ),
                          const SizedBox(width: kSpace3),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text('Yordam kerakmi?',
                                    style: TextStyle(
                                        color: agOnPrimary,
                                        fontWeight: FontWeight.w800,
                                        fontSize: kFontTitle)),
                                Text("24/7 qo'llab-quvvatlash xizmati",
                                    style: TextStyle(
                                        color: agOnPrimary.withValues(alpha: 0.75),
                                        fontSize: kFontCaption,
                                        fontWeight: FontWeight.w600)),
                              ],
                            ),
                          ),
                          const Icon(Icons.arrow_forward_rounded, color: agBright, size: 22),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: kSpace4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: kSpace4),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agCardShadow,
                  ),
                  child: Column(
                    children: [
                      _MenuRow(icon: Icons.account_balance_wallet_rounded, iconColor: agGreenText, label: 'Hamyon va kartalar',
                          onTap: () => _push(context, const WalletScreen())),
                      _MenuRow(icon: Icons.receipt_long_rounded, label: 'Buyurtmalar tarixi',
                          onTap: () => context.read<SuperappProvider>().tabIndex = 1),
                      // Four rows here used to dead-end in a "tez kunda"
                      // snackbar. "Saqlangan manzillar" now opens the address
                      // manager that FavoritesProvider has always backed;
                      // "Sevimlilar" was the same feature under a second name,
                      // and "Bonuslar" duplicated the two rows below it, so
                      // both are gone. "Mening baholarim" has no endpoint
                      // behind it at all — a passenger-ratings API does not
                      // exist — so advertising it was the wrong call.
                      _MenuRow(icon: Icons.place_rounded, label: 'Saqlangan manzillar',
                          onTap: () => _push(
                                context,
                                const DestinationScreen(isSavingFavorite: true),
                              )),
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
                const SizedBox(height: kSpace4),
                Semantics(
                  button: true,
                  label: 'Chiqish',
                  excludeSemantics: true,
                  child: GestureDetector(
                    onTap: () => auth.logout(),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      height: kControlHeightSm,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: agSurface,
                        borderRadius: BorderRadius.circular(kRadiusMd),
                        border: Border.all(color: kErrorBorder),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.logout_rounded, size: 20, color: kErrorDeep),
                          SizedBox(width: kSpace2),
                          Text('Chiqish',
                              style: TextStyle(
                                  color: kErrorDeep,
                                  fontWeight: FontWeight.w800,
                                  fontSize: kFontBody)),
                        ],
                      ),
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
          padding: const EdgeInsets.symmetric(vertical: kSpace3),
          decoration: BoxDecoration(
            color: agSurface.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(kRadiusMd),
          ),
          child: Column(
            children: [
              Text(value,
                  style: const TextStyle(
                      color: agOnPrimary, fontWeight: FontWeight.w800, fontSize: kFontH2)),
              Text(label,
                  style: const TextStyle(
                      color: agOnPrimary, fontSize: kFontMicro, fontWeight: FontWeight.w600)),
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
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: kMinTapTarget),
          padding: const EdgeInsets.symmetric(vertical: kSpace4),
          decoration: BoxDecoration(
            border: last ? null : const Border(bottom: BorderSide(color: agDivider)),
          ),
          child: Row(
            children: [
              Icon(icon, size: 23, color: iconColor),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Text(label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText)),
              ),
              const Icon(Icons.chevron_right_rounded, size: 20, color: agMuted),
            ],
          ),
        ),
      ),
    );
  }
}
