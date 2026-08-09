import 'package:angren_taxi/core/config/app_config.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/core/storage/local_storage.dart';
import 'package:angren_taxi/features/superapp/screens/support_screen.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late bool _push = sl<LocalStorage>().getPushEnabled();
  bool _savingPush = false;

  /// Turns push delivery on or off for this device.
  ///
  /// The toggle used to be pure `setState` — it reset on every rebuild and was
  /// wired to nothing, so switching it off changed no behaviour at all. It now
  /// persists the choice and tells the server, which is what actually stops
  /// (or resumes) notifications for this device's FCM token.
  Future<void> _setPush(bool enabled) async {
    setState(() {
      _push = enabled;
      _savingPush = true;
    });

    await sl<LocalStorage>().savePushEnabled(enabled);

    try {
      final token = enabled ? await FirebaseMessaging.instance.getToken() : null;
      await sl<ApiClient>().post(
        ApiEndpoints.registerFcmToken,
        // A null token unregisters this device server-side.
        data: {'fcmToken': token},
      );
    } catch (e) {
      debugPrint('[Settings] push toggle sync failed: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Sozlama saqlandi, lekin serverga yuborilmadi'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _savingPush = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(title: 'Sozlamalar', onBack: () => Navigator.of(context).pop()),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
              children: [
                // Only settings that do something are listed.
                //
                // Removed: a UZ/RU language switcher (the app has no
                // localisation — every string is a hardcoded Uzbek literal, so
                // the switch could never have worked), a dark-mode toggle
                // (there is no dark theme), and "Face ID bilan kirish" (no
                // biometric auth exists). All three were local setState that
                // reset on rebuild.
                _label('UMUMIY'),
                _group([
                  _toggleRow(
                    Icons.notifications_rounded,
                    'Push bildirishnomalar',
                    _push,
                    _savingPush ? null : (v) => _setPush(v),
                    last: true,
                  ),
                ]),
                const SizedBox(height: kSpace5),
                _label('YORDAM'),
                _group([
                  _navRow(Icons.support_agent_rounded, 'Yordam markazi', last: true,
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SupportScreen()))),
                ]),
                const SizedBox(height: kSpace6),
                const Center(
                  // Was hardcoded "2.4.0" while pubspec said 1.0.0.
                  child: Text('Angren Go · versiya ${AppConfig.appVersion}',
                      style: TextStyle(color: agSubtle, fontWeight: FontWeight.w600, fontSize: kFontCaption)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(kSpace1, 0, kSpace1, kSpace2),
        child: Text(text, style: const TextStyle(fontSize: kFontCaption, fontWeight: FontWeight.w800, letterSpacing: 1, color: agSubtle)),
      );

  Widget _group(List<Widget> rows) => Container(
        padding: const EdgeInsets.symmetric(horizontal: kSpace4),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(kRadiusLg),
          boxShadow: agCardShadow,
        ),
        child: Column(children: rows),
      );


  Widget _toggleRow(IconData icon, String label, bool value, ValueChanged<bool>? onChanged, {bool last = false}) {
    return Container(
      constraints: const BoxConstraints(minHeight: kMinTapTarget),
      padding: const EdgeInsets.symmetric(vertical: kSpace3),
      decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: agDivider))),
      child: Row(
        children: [
          ExcludeSemantics(child: Icon(icon, size: 22, color: agSubtle)),
          const SizedBox(width: kSpace3),
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText))),
          Switch.adaptive(
            value: value,
            onChanged: onChanged,
            // Faol track — interaktiv to'ldirish; oq thumb `agPrimary`
            // ustida 5.38:1 (mint ustida atigi 2.12:1 bo'lardi).
            activeTrackColor: agPrimary,
            activeColor: agOnPrimary,
          ),
        ],
      ),
    );
  }

  Widget _navRow(IconData icon, String label, {bool last = false, VoidCallback? onTap}) {
    return Semantics(
      button: onTap != null,
      label: label,
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          constraints: const BoxConstraints(minHeight: kMinTapTarget),
          padding: const EdgeInsets.symmetric(vertical: kSpace4),
          decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: agDivider))),
          child: Row(
            children: [
              Icon(icon, size: 22, color: agSubtle),
              const SizedBox(width: kSpace3),
              Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText))),
              const Icon(Icons.chevron_right_rounded, size: 20, color: agSubtle),
            ],
          ),
        ),
      ),
    );
  }
}
