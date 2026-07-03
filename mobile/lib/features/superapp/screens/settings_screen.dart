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
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                _label('UMUMIY'),
                _group([
                  Row(
                    children: [
                      const Icon(Icons.language_rounded, size: 22, color: agSubtle),
                      const SizedBox(width: 13),
                      const Expanded(child: Text('Til', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText))),
                      _langChip('UZ'),
                      const SizedBox(width: 6),
                      _langChip('RU'),
                    ],
                  ),
                  _toggleRow(Icons.dark_mode_rounded, 'Tungi rejim', _dark, (v) => setState(() => _dark = v)),
                  _toggleRow(Icons.notifications_rounded, 'Push bildirishnomalar', _push, (v) => setState(() => _push = v), last: true),
                ]),
                const SizedBox(height: 20),
                _label('XAVFSIZLIK'),
                _group([
                  _toggleRow(Icons.fingerprint_rounded, 'Face ID bilan kirish', _faceId, (v) => setState(() => _faceId = v)),
                  _navRow(Icons.shield_rounded, 'Maxfiylik'),
                  _navRow(Icons.support_agent_rounded, 'Yordam markazi', last: true,
                      onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const SupportScreen()))),
                ]),
                const SizedBox(height: 22),
                const Center(
                  child: Text('Angren Go · versiya 2.4.0',
                      style: TextStyle(color: agMuted, fontWeight: FontWeight.w600, fontSize: 12)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
        child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1, color: agMuted)),
      );

  Widget _group(List<Widget> rows) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(
          color: agSurface,
          borderRadius: BorderRadius.circular(20),
          boxShadow: agCardShadow,
        ),
        child: Column(children: rows),
      );

  Widget _langChip(String code) {
    final active = _lang == code;
    return GestureDetector(
      onTap: () => setState(() => _lang = code),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(color: active ? agGreen : agBg, borderRadius: BorderRadius.circular(9)),
        child: Text(code, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: active ? Colors.white : agText)),
      ),
    );
  }

  Widget _toggleRow(IconData icon, String label, bool value, ValueChanged<bool> onChanged, {bool last = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 11),
      decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: agDivider))),
      child: Row(
        children: [
          Icon(icon, size: 22, color: agSubtle),
          const SizedBox(width: 13),
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText))),
          Switch.adaptive(value: value, onChanged: onChanged, activeTrackColor: agMint, activeColor: Colors.white),
        ],
      ),
    );
  }

  Widget _navRow(IconData icon, String label, {bool last = false, VoidCallback? onTap}) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 15),
        decoration: BoxDecoration(border: last ? null : const Border(bottom: BorderSide(color: agDivider))),
        child: Row(
          children: [
            Icon(icon, size: 22, color: agSubtle),
            const SizedBox(width: 13),
            Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: agText))),
            const Icon(Icons.chevron_right_rounded, size: 20, color: Color(0xFFC2CCD4)),
          ],
        ),
      ),
    );
  }
}
