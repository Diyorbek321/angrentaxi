import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Maxfiylik siyosati sahifasi (backend `GET /legal/privacy`) — joriy tilda.
Uri privacyPolicyUri() => Uri.parse(
      '${AppConfig.apiBaseUrl}/legal/privacy?lang=${AppL10n.localeName == 'ru' ? 'ru' : 'uz'}',
    );

/// Siyosatni brauzerda ochadi (ilova ichidagi WebView emas — havola
/// allowlist'ga bog'liq bo'lmasin va foydalanuvchi uni saqlay olsin).
Future<void> openPrivacyPolicy() =>
    launchUrl(privacyPolicyUri(), mode: LaunchMode.externalApplication);

/// Profil pastidagi "Maxfiylik siyosati" va "Hisobni o'chirish" havolalari.
///
/// Google Play: hisob ochiladigan ilova uni ilova ICHIDA o'chirish imkonini
/// berishi shart. Ataylab ko'zga tashlanmaydigan matnli tugma — chiqish
/// tugmasi bilan raqobatlashmaydi, lekin qidirgan odam topadi.
class AccountLegalActions extends StatelessWidget {
  const AccountLegalActions({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextButton(
          onPressed: openPrivacyPolicy,
          style: TextButton.styleFrom(minimumSize: const Size(0, kMinTapTarget)),
          child: Text(
            context.l10n.accPrivacyPolicy,
            style: const TextStyle(color: kInkMuted, fontSize: kFontCaption),
          ),
        ),
        TextButton(
          onPressed: () => _confirmDelete(context),
          style: TextButton.styleFrom(minimumSize: const Size(0, kMinTapTarget)),
          child: Text(
            context.l10n.accDeleteButton,
            style: const TextStyle(color: kErrorDeep, fontSize: kFontCaption),
          ),
        ),
      ],
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final auth = context.read<AuthProvider>();
    final l10n = context.l10n;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.accDeleteTitle),
        content: Text(l10n.accDeleteBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.commonCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.accDeleteConfirm, style: const TextStyle(color: kErrorDeep)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    final result = await auth.deleteAccount();
    if (result.deleted || !context.mounted) return;

    // Rad etildi — server barcha sabablarni bir yo'la beradi, foydalanuvchi
    // bir urinishda nimani hal qilishni ko'radi.
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.accDeleteBlockedTitle),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (final reason in result.reasons)
              Padding(
                padding: const EdgeInsets.only(bottom: kSpace2),
                child: Text('• $reason'),
              ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.accDeleteOk),
          ),
        ],
      ),
    );
  }
}
