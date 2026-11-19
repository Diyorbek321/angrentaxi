import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/auth/auth_provider.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Opens a legal page (privacy policy / terms) in an in-app browser view.
Future<void> openLegalUrl(BuildContext context, String url) async {
  final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.inAppBrowserView);
  if (!ok && context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text("Sahifani ochib bo'lmadi")),
    );
  }
}

Future<void> openPrivacyPolicy(BuildContext context) =>
    openLegalUrl(context, AppConfig.privacyPolicyUrl);

Future<void> openTerms(BuildContext context) =>
    openLegalUrl(context, AppConfig.termsUrl);

/// Asks for confirmation, then permanently deletes the account
/// (App Store guideline 5.1.1(v): deletion must be possible in-app).
Future<void> confirmAndDeleteAccount(BuildContext context) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: const Text("Hisobni o'chirish"),
      content: const Text(
        "Hisobingiz va shaxsiy ma'lumotlaringiz (telefon raqam, ism, "
        "saqlangan manzillar) butunlay o'chiriladi. Bu amalni ortga "
        "qaytarib bo'lmaydi.",
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(false),
          child: const Text('Bekor qilish'),
        ),
        TextButton(
          key: const ValueKey('confirm_delete_account'),
          onPressed: () => Navigator.of(ctx).pop(true),
          child: const Text("O'chirish", style: TextStyle(color: kErrorDeep)),
        ),
      ],
    ),
  );
  if (confirmed != true || !context.mounted) return;

  final messenger = ScaffoldMessenger.of(context);
  final error = await context.read<AuthProvider>().deleteAccount();
  if (error != null) {
    messenger.showSnackBar(SnackBar(content: Text(error)));
  }
}

/// Low-emphasis destructive link shown under the logout button on every
/// profile screen.
class DeleteAccountButton extends StatelessWidget {
  const DeleteAccountButton({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: TextButton(
        key: const ValueKey('delete_account_button'),
        onPressed: () => confirmAndDeleteAccount(context),
        child: const Text(
          "Hisobni o'chirish",
          style: TextStyle(color: kErrorDeep, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }
}
