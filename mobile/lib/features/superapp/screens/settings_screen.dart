import 'package:angren_taxi/features/superapp/screens/support_screen.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  String _lang = 'UZ';
  bool _dark = false;
  bool _push = true;
  bool _faceId = true;

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
                _label('UMUMIY'),
                _group([
                  Row(
                    children: [
                      const ExcludeSemantics(
                        child: Icon(Icons.language_rounded, size: 22, color: agSubtle),
                      ),
                      const SizedBox(width: kSpace3),
                      const Expanded(child: Text('Til', style: TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText))),
                      _langChip('UZ'),
                      const SizedBox(width: kSpace2),
                      _langChip('RU'),
                    ],
                  ),
                  _toggleRow(Icons.dark_mode_rounded, 'Tungi rejim', _dark, (v) => setState(() => _dark = v)),
                  _toggleRow(Icons.notifications_rounded, 'Push bildirishnomalar', _push, (v) => setState(() => _push = v), last: true),
                ]),
                const SizedBox(height: kSpace5),
                _label('XAVFSIZLIK'),
                _group([
                  _toggleRow(Icons.fingerprint_rounded, 'Face ID bilan kirish', _faceId, (v) => setState(() => _faceId = v)),
                  _navRow(Icons.shield_rounded, 'Maxfiylik'),
                  _navRow(Icons.support_agent_rounded, 'Yordam markazi', last: true,
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SupportScreen()))),
                ]),
                const SizedBox(height: kSpace6),
                const Center(
                  child: Text('Angren Go · versiya 2.4.0',
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

  Widget _langChip(String code) {
    final active = _lang == code;
    return Semantics(
      button: true,
      selected: active,
      label: code,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () => setState(() => _lang = code),
        behavior: HitTestBehavior.opaque,
        child: Container(
          constraints: const BoxConstraints(
            minHeight: kMinTapTarget,
            minWidth: kMinTapTarget,
          ),
          alignment: Alignment.center,
          padding: const EdgeInsets.symmetric(horizontal: kSpace3, vertical: kSpace2),
          decoration: BoxDecoration(
            // Faol chip — interaktiv to'ldirish (`agPrimary` + oq, 5.38:1).
            // `agGreen` (#10A064) oq yozuv bilan atigi 3.3:1 berardi.
            color: active ? agPrimary : agBg,
            borderRadius: BorderRadius.circular(kRadiusSm),
            border: Border.all(color: active ? agPrimary : agBorder),
          ),
          child: Text(
            code,
            style: TextStyle(
              fontSize: kFontLabel,
              fontWeight: FontWeight.w800,
              color: active ? agOnPrimary : agText,
            ),
          ),
        ),
      ),
    );
  }

  Widget _toggleRow(IconData icon, String label, bool value, ValueChanged<bool> onChanged, {bool last = false}) {
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
