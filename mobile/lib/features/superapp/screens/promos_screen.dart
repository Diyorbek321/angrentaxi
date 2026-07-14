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
    if (_loading) {
      return const Center(
        child: CircularProgressIndicator(color: agGreen),
      );
    }

    if (_loadError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline_rounded, color: agRed, size: 40),
              const SizedBox(height: 12),
              Text(
                _loadError!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: agSubtle, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
              GestureDetector(
                onTap: _load,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                  decoration: BoxDecoration(color: agGreen, borderRadius: BorderRadius.circular(12)),
                  child: const Text('Qayta urinish',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_promoCodes.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.confirmation_number_outlined, color: agMuted, size: 40),
              SizedBox(height: 12),
              Text(
                'Hozircha faol promokodlar yo\'q',
                textAlign: TextAlign.center,
                style: TextStyle(color: agSubtle, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.separated(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
      itemCount: _promoCodes.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
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
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [agInk, Color(0xFF1D3A2F)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(22),
        boxShadow: [
          BoxShadow(color: agInk.withValues(alpha: 0.22), blurRadius: 32, offset: const Offset(0, 14)),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          Positioned(
            right: -14,
            top: -14,
            child: Icon(Icons.redeem_rounded, size: 110, color: agBright.withValues(alpha: 0.2)),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: agBright, borderRadius: BorderRadius.circular(8)),
                child: const Text('FAOL', style: TextStyle(color: Color(0xFF06231A), fontSize: 11, fontWeight: FontWeight.w800)),
              ),
              const SizedBox(height: 12),
              Text(
                promoDiscountText(promo),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 24, letterSpacing: -0.5),
              ),
              const SizedBox(height: 10),
              GestureDetector(
                onTap: onCopy,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        promo.code,
                        style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: 1),
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.copy_rounded, size: 15, color: Colors.white),
                    ],
                  ),
                ),
              ),
              if (minOrderAmount > 0 || expiresAt != null) ...[
                const SizedBox(height: 10),
                Text(
                  [
                    if (minOrderAmount > 0)
                      "Min. buyurtma: ${Formatters.formatSom(minOrderAmount)}",
                    if (expiresAt != null) "${Formatters.formatDate(expiresAt)}gacha",
                  ].join(' · '),
                  style: const TextStyle(color: Colors.white60, fontSize: 12.5, fontWeight: FontWeight.w600),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
