// "Aksiyalar va promokodlar" — list of currently-active, usable promo codes,
// backed by backend/src/modules/promo-codes:
//   GET /promo-codes/active -> PromoCode[] (no DTO/mapping layer, see
//   backend/src/database/entities/promo_code.entity.ts), newest first,
//   empty array (not 404) when nothing is active.
//
// Read-only list, no mutations — the ApiClient call lives directly in this
// screen's State (same pattern as
// lib/features/passenger/screens/referral_screen.dart) rather than a
// dedicated provider.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/promo_code.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_empty_state.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class PromosScreen extends StatefulWidget {
  const PromosScreen({super.key, ApiClient? apiClient})
      : _apiClient = apiClient;

  final ApiClient? _apiClient;

  @override
  State<PromosScreen> createState() => _PromosScreenState();
}

class _PromosScreenState extends State<PromosScreen> {
  late final ApiClient _apiClient = widget._apiClient ?? sl<ApiClient>();

  bool _loading = true;
  String? _loadError;
  List<PromoCode> _promoCodes = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final response = await _apiClient.get(ApiEndpoints.activePromoCodes);
      final data = response.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>;
      final promoCodes = list
          .map((e) => PromoCode.fromJson(e as Map<String, dynamic>))
          .toList();
      if (!mounted) return;
      setState(() {
        _promoCodes = promoCodes;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = extractErrorMessage(e);
        _loading = false;
      });
    }
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Kod nusxalandi')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: 'Aksiyalar va promokodlar',
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    // Uch holat: yuklanmoqda → skeleton, xato → `AppErrorState`,
    // bo'sh → `AppEmptyState`. Ko'rinadigan matnlar o'zgarmagan.
    if (_loading) {
      return const AppSkeletonList(
        itemCount: 3,
        hasLeading: false,
        lines: 3,
        padding: EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
      );
    }

    if (_loadError != null) {
      return AppErrorState(message: _loadError!, onRetry: _load);
    }

    if (_promoCodes.isEmpty) {
      return const AppEmptyState(
        icon: Icons.confirmation_number_outlined,
        title: 'Hozircha faol promokodlar yo\'q',
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
      itemCount: _promoCodes.length,
      separatorBuilder: (_, __) => const SizedBox(height: kSpace3),
      itemBuilder: (context, index) {
        final promo = _promoCodes[index];
        return _PromoCard(
          promo: promo,
          onCopy: () => _copyCode(promo.code),
        );
      },
    );
  }
}

/// Formats a promo's percent/fixed discount as human-readable copy, e.g.
/// "-20%" or "-15 000 so'm". [PromoCode.discountPercent] and
/// [PromoCode.discountFixed] are mutually exclusive per the backend contract.
String promoDiscountText(PromoCode promo) {
  final percent = promo.discountPercent;
  if (percent != null) {
    final formatted =
        percent == percent.roundToDouble() ? percent.toInt().toString() : percent.toStringAsFixed(1);
    return '-$formatted%';
  }
  final fixed = promo.discountFixed;
  if (fixed != null) {
    return '-${Formatters.formatSom(fixed)}';
  }
  return '';
}

class _PromoCard extends StatelessWidget {
  const _PromoCard({required this.promo, required this.onCopy});

  final PromoCode promo;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final expiresAt = promo.expiresAt;
    final minOrderAmount = promo.minOrderAmount;

    return Container(
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: kGradientInkColors,
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(kRadiusLg),
        boxShadow: agInkShadow,
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned(
            right: -14,
            top: -14,
            child: ExcludeSemantics(
              child: Icon(Icons.redeem_rounded,
                  size: 110, color: agBright.withValues(alpha: 0.2)),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Holat faqat rang bilan emas — ikonka + 'FAOL' yozuvi birga.
              Container(
                padding: const EdgeInsets.symmetric(horizontal: kSpace2 + 2, vertical: kSpace1),
                decoration: BoxDecoration(color: agBright, borderRadius: BorderRadius.circular(kRadiusXs)),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle_rounded, size: 12, color: agOnMint),
                    SizedBox(width: kSpace1),
                    Text('FAOL', style: TextStyle(color: agOnMint, fontSize: kFontMicro, fontWeight: FontWeight.w800)),
                  ],
                ),
              ),
              const SizedBox(height: kSpace3),
              Text(
                promoDiscountText(promo),
                style: const TextStyle(color: agOnPrimary, fontWeight: FontWeight.w800, fontSize: kFontH1, letterSpacing: -0.5),
              ),
              const SizedBox(height: kSpace2),
              Semantics(
                button: true,
                label: 'Promokodni nusxalash: ${promo.code}',
                excludeSemantics: true,
                child: GestureDetector(
                  onTap: onCopy,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    constraints: const BoxConstraints(
                      minHeight: kMinTapTarget,
                      minWidth: kMinTapTarget,
                    ),
                    alignment: Alignment.center,
                    padding: const EdgeInsets.symmetric(horizontal: kSpace3, vertical: kSpace2),
                    decoration: BoxDecoration(
                      color: agOnPrimary.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(kRadiusSm),
                      border: Border.all(color: agOnPrimary.withValues(alpha: 0.25)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          promo.code,
                          style: const TextStyle(color: agOnPrimary, fontSize: kFontBody, fontWeight: FontWeight.w800, letterSpacing: 1),
                        ),
                        const SizedBox(width: kSpace2),
                        const Icon(Icons.copy_rounded, size: 15, color: agOnPrimary),
                      ],
                    ),
                  ),
                ),
              ),
              if (minOrderAmount > 0 || expiresAt != null) ...[
                const SizedBox(height: kSpace3),
                Text(
                  [
                    if (minOrderAmount > 0)
                      "Min. buyurtma: ${Formatters.formatSom(minOrderAmount)}",
                    if (expiresAt != null) "${Formatters.formatDate(expiresAt)}gacha",
                  ].join(' · '),
                  style: TextStyle(color: agOnPrimary.withValues(alpha: 0.75), fontSize: kFontCaption, fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
