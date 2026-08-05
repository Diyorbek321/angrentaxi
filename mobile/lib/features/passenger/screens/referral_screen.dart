// "Do'stlarni taklif qilish" — the invite-a-friend bonus program screen,
// backed by backend/src/modules/referrals:
//   GET  /users/me/referral        -> {referralCode, referredCount, totalBonusEarned}
//   POST /users/me/referral/apply  -> {code} -> full updated User
//
// The GET response never tells us whether the caller has already applied a
// friend's code (that's `referredByUserId`, only visible on the POST
// response), so the "enter a friend's code" field is always shown — a
// second attempt after a successful one just surfaces the backend's
// "already applied" error, which we translate into a friendly message.
//
// No share package exists in pubspec.yaml and this sandbox has no network
// access to add one (share_plus isn't in the local pub cache), so "Ulashish"
// falls back to copying a pre-written invite message to the clipboard
// instead of opening the OS share sheet — see the mobile engineer's report
// for the tradeoff.
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/shared/models/referral_info.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class ReferralScreen extends StatefulWidget {
  const ReferralScreen({super.key, ApiClient? apiClient})
      : _apiClient = apiClient;

  final ApiClient? _apiClient;

  @override
  State<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends State<ReferralScreen> {
  late final ApiClient _apiClient = widget._apiClient ?? sl<ApiClient>();
  final TextEditingController _codeController = TextEditingController();

  bool _loading = true;
  String? _loadError;
  ReferralInfo? _info;

  bool _applying = false;
  String? _applyError;
  bool _applied = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final response = await _apiClient.get(ApiEndpoints.myReferralInfo);
      final data = response.data as Map<String, dynamic>;
      final info = ReferralInfo.fromJson(data['data'] as Map<String, dynamic>);
      if (!mounted) return;
      setState(() {
        _info = info;
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

  Future<void> _applyCode() async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      setState(() => _applyError = 'Kodni kiriting');
      return;
    }

    setState(() {
      _applying = true;
      _applyError = null;
    });

    try {
      await _apiClient.post(
        ApiEndpoints.applyReferralCode,
        data: {'code': code},
      );
      if (!mounted) return;
      setState(() {
        _applying = false;
        _applied = true;
        _applyError = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Referral kodi qo'llandi!")),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _applying = false;
        _applyError = _friendlyApplyError(extractErrorMessage(e));
      });
    }
  }

  void _copyCode(String code) {
    Clipboard.setData(ClipboardData(text: code));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Kod nusxalandi')),
    );
  }

  void _shareCode(String code) {
    final message =
        "Angren Taxi'ga taklif qilaman! Ro'yxatdan o'tishda mening "
        "kodimni kiriting: $code";
    Clipboard.setData(ClipboardData(text: message));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text("Taklif matni nusxalandi — do'stingizga yuboring"),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: Column(
        children: [
          AgHeader(
            title: "Do'stlarni taklif qilish",
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  /// Uch holat: yuklanmoqda (skeleton, spinner emas) - xato - kontent.
  Widget _buildBody() {
    if (_loading) {
      return const AppSkeletonList(itemCount: 3, lines: 2, hasTrailing: true);
    }

    if (_loadError != null) {
      return AppErrorState(message: _loadError!, onRetry: _load);
    }

    final info = _info!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(kSpace4, kSpace5, kSpace4, kSpace8),
      children: [
        _CodeCard(
          code: info.referralCode,
          onCopy: () => _copyCode(info.referralCode),
          onShare: () => _shareCode(info.referralCode),
        ),
        const SizedBox(height: kSpace5),
        Row(
          children: [
            Expanded(
              child: _StatTile(
                label: 'Taklif qilinganlar',
                value: '${info.referredCount}',
                icon: Icons.group_rounded,
                color: kInfoDeep,
              ),
            ),
            const SizedBox(width: kSpace3),
            Expanded(
              child: _StatTile(
                label: 'Jami bonus',
                value: Formatters.formatSom(info.totalBonusEarned),
                icon: Icons.workspace_premium_rounded,
                color: kWarningDeep,
              ),
            ),
          ],
        ),
        const SizedBox(height: kSpace6),
        const Text(
          "Do'stingizning kodini kiriting",
          style: TextStyle(
            fontSize: kFontTitle,
            fontWeight: FontWeight.w800,
            color: kInk,
          ),
        ),
        const SizedBox(height: kSpace3),
        _ApplyCodeSection(
          controller: _codeController,
          applying: _applying,
          applied: _applied,
          errorMessage: _applyError,
          onSubmit: _applyCode,
        ),
      ],
    );
  }
}

/// Maps the backend's raw BadRequestException messages
/// (backend/src/modules/referrals/referrals.service.ts) to friendly Uzbek
/// copy; falls back to the raw message for anything unexpected.
String _friendlyApplyError(String raw) {
  final lower = raw.toLowerCase();
  if (lower.contains('already been applied') || lower.contains('already applied')) {
    return "Sizda allaqachon referral kodi qo'llangan";
  }
  if (lower.contains('cannot use your own')) {
    return "O'zingizning kodingizni qo'llay olmaysiz";
  }
  if (lower.contains('invalid referral code')) {
    return 'Bunday referral kod topilmadi';
  }
  return raw;
}

class _CodeCard extends StatelessWidget {
  const _CodeCard(
      {required this.code, required this.onCopy, required this.onShare});

  final String code;
  final VoidCallback onCopy;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace5),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: kGradientInkColors,
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
        borderRadius: BorderRadius.circular(kRadiusLg),
        boxShadow: kShadowInk,
      ),
      child: Stack(
        clipBehavior: Clip.hardEdge,
        children: [
          // Dekorativ mint aksent — to'q yuzada, matn ortida.
          Positioned(
            right: -14,
            top: -14,
            child: ExcludeSemantics(
              child: Icon(Icons.group_add_rounded,
                  size: 110, color: kMintBright.withValues(alpha: 0.2)),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'SIZNING REFERRAL KODINGIZ',
                style: TextStyle(
                  color: kOnPrimary.withValues(alpha: 0.7),
                  fontSize: kFontMicro,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: kSpace3),
              Text(
                code,
                style: const TextStyle(
                  color: kOnPrimary,
                  fontSize: kFontDisplay,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 4,
                ),
              ),
              const SizedBox(height: kSpace1 + 2),
              Text(
                "Do'stingiz ilovaga birinchi safarida ushbu kodni kiritsa, ikkovingiz ham bonus olasiz",
                style: TextStyle(
                  color: kOnPrimary.withValues(alpha: 0.7),
                  fontSize: kFontCaption,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: kSpace5),
              Row(
                children: [
                  Expanded(
                    child: _CardActionButton(
                      icon: Icons.copy_rounded,
                      label: 'Nusxalash',
                      onTap: onCopy,
                    ),
                  ),
                  const SizedBox(width: kSpace3),
                  Expanded(
                    child: _CardActionButton(
                      icon: Icons.share_rounded,
                      label: 'Ulashish',
                      filled: true,
                      onTap: onShare,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CardActionButton extends StatelessWidget {
  const _CardActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
    this.filled = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    // Mint to'ldirish ustida ink matn (9.01:1); to'ldirilmagan variant to'q
    // karta ustida oq matn.
    final foreground = filled ? kOnMint : kOnPrimary;
    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          height: kControlHeightSm,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color:
                filled ? kMintBright : kOnPrimary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(kRadiusMd),
            border: filled
                ? null
                : Border.all(color: kOnPrimary.withValues(alpha: 0.25)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 17, color: foreground),
              const SizedBox(width: kSpace1 + 2),
              Text(
                label,
                style: TextStyle(
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w800,
                  color: foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        boxShadow: kShadowCard,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.14),
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
          ),
          const SizedBox(height: kSpace3),
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: kFontTitle,
              fontWeight: FontWeight.w800,
              color: kInk,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: const TextStyle(
              fontSize: kFontMicro,
              color: kInkMuted,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ApplyCodeSection extends StatelessWidget {
  const _ApplyCodeSection({
    required this.controller,
    required this.applying,
    required this.applied,
    required this.errorMessage,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool applying;
  final bool applied;
  final String? errorMessage;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    if (applied) {
      return Container(
        padding: const EdgeInsets.all(kSpace4),
        decoration: BoxDecoration(
          color: kMintTint,
          borderRadius: BorderRadius.circular(kRadiusMd),
        ),
        // kMintTint yuza ustidagi matn/ikona — kPrimary (5.38:1).
        child: const Row(
          children: [
            Icon(Icons.check_circle_rounded, color: kPrimary, size: 22),
            SizedBox(width: kSpace3),
            Expanded(
              child: Text(
                "Referral kodi muvaffaqiyatli qo'llandi",
                style: TextStyle(
                  color: kPrimary,
                  fontWeight: FontWeight.w700,
                  fontSize: kFontLabel,
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextField(
                controller: controller,
                textCapitalization: TextCapitalization.characters,
                enabled: !applying,
                decoration: InputDecoration(
                  filled: true,
                  fillColor: kSurface,
                  hintText: "Do'stingizning kodini kiriting",
                  hintStyle:
                      const TextStyle(color: kInkMuted, fontSize: kFontBody),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: kSpace4, vertical: kSpace4),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                    borderSide: const BorderSide(color: kPrimary, width: 2),
                  ),
                ),
                onSubmitted: (_) => onSubmit(),
              ),
            ),
            const SizedBox(width: kSpace3),
            SizedBox(
              height: kControlHeightSm,
              child: ElevatedButton(
                onPressed: applying ? null : onSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: kPrimary,
                  foregroundColor: kOnPrimary,
                  disabledBackgroundColor: kPrimaryDisabled,
                  disabledForegroundColor: kInkMuted,
                  minimumSize: const Size(0, kControlHeightSm),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(kRadiusMd),
                  ),
                  padding:
                      const EdgeInsets.symmetric(horizontal: kSpace5),
                ),
                child: applying
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: kOnPrimary),
                      )
                    : const Text(
                        "Qo'llash",
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          fontSize: kFontLabel,
                        ),
                      ),
              ),
            ),
          ],
        ),
        if (errorMessage != null) ...[
          const SizedBox(height: kSpace2),
          InlineErrorWidget(message: errorMessage!),
        ],
      ],
    );
  }
}
