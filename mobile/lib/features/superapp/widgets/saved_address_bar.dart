import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/favorite_address.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/material.dart';

/// Checkout'dagi saqlangan manzillar qatori: "Uy", "Ish", ... bir bosishda
/// manzil va podyezd/qavat to'ldiriladi. Oxirida — tanlangan manzilni
/// saqlash chipi (agar u hali saqlanmagan bo'lsa).
class SavedAddressBar extends StatelessWidget {
  const SavedAddressBar({
    super.key,
    required this.favorites,
    required this.selected,
    required this.onSelect,
    this.onSave,
    this.enabled = true,
  });

  final List<FavoriteAddress> favorites;

  /// Hozirgi yetkazish nuqtasi — mos saqlangan manzil belgilanadi.
  final OrderLocation? selected;
  final ValueChanged<FavoriteAddress> onSelect;

  /// `null` — saqlash chipi ko'rsatilmaydi.
  final VoidCallback? onSave;
  final bool enabled;

  /// ~1 m aniqlik: xaritadan qayta tanlangan bir xil nuqta ham mos keladi.
  static bool sameSpot(FavoriteAddress f, OrderLocation? l) =>
      l != null && (f.lat - l.lat).abs() < 1e-5 && (f.lng - l.lng).abs() < 1e-5;

  @override
  Widget build(BuildContext context) {
    if (favorites.isEmpty && onSave == null) return const SizedBox.shrink();
    return SizedBox(
      height: 40,
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final f in favorites) ...[
            _chip(
              key: ValueKey('saved-address-${f.id}'),
              icon: f.icon,
              iconColor: f.color,
              label: f.label.isEmpty ? f.address : f.label,
              active: sameSpot(f, selected),
              onTap: enabled
                  ? () {
                      AppHaptics.tap();
                      onSelect(f);
                    }
                  : null,
            ),
            const SizedBox(width: kSpace2),
          ],
          if (onSave != null)
            _chip(
              key: const ValueKey('saved-address-save'),
              icon: Icons.bookmark_add_outlined,
              iconColor: agGreenText,
              label: context.l10n.saSaveAddressAction,
              active: false,
              onTap: enabled ? onSave : null,
            ),
        ],
      ),
    );
  }

  Widget _chip({
    required Key key,
    required IconData icon,
    required Color iconColor,
    required String label,
    required bool active,
    required VoidCallback? onTap,
  }) {
    return Semantics(
      key: key,
      button: true,
      selected: active,
      child: Material(
        color: active ? agTint : agSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRadiusSm),
          side: BorderSide(color: active ? agGreenText : kLineInteractive),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(kRadiusSm),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: kSpace3),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(icon, size: 18, color: iconColor),
                const SizedBox(width: kSpace1),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 160),
                  child: Text(
                    label,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: kFontLabel,
                      fontWeight: FontWeight.w700,
                      color: agText,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Manzil nomini so'raydi: tezkor "Uy / Ish / Ota-onam" yoki o'z nomi.
/// `null` — bekor qilindi.
Future<String?> askAddressLabel(BuildContext context) => showDialog<String>(
      context: context,
      builder: (_) => const _AddressLabelDialog(),
    );

class _AddressLabelDialog extends StatefulWidget {
  const _AddressLabelDialog();

  @override
  State<_AddressLabelDialog> createState() => _AddressLabelDialogState();
}

class _AddressLabelDialogState extends State<_AddressLabelDialog> {
  static const int _maxLength = 50;
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit(String value) {
    final label = value.trim();
    if (label.isEmpty) return;
    Navigator.pop(context, label.length > _maxLength ? label.substring(0, _maxLength) : label);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return AlertDialog(
      title: Text(l10n.saSaveAddressTitle),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: kSpace2,
            runSpacing: kSpace2,
            children: [
              for (final quick in [
                l10n.saAddressLabelHome,
                l10n.saAddressLabelWork,
                l10n.saAddressLabelParents,
              ])
                ActionChip(
                  key: ValueKey('address-label-$quick'),
                  label: Text(quick),
                  onPressed: () => _submit(quick),
                ),
            ],
          ),
          const SizedBox(height: kSpace3),
          TextField(
            key: const ValueKey('address-label-input'),
            controller: _controller,
            maxLength: _maxLength,
            textInputAction: TextInputAction.done,
            decoration: InputDecoration(hintText: l10n.saSaveAddressHint),
            onSubmitted: _submit,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text(l10n.saDialogCancel),
        ),
        FilledButton(
          key: const ValueKey('address-label-save'),
          onPressed: () => _submit(_controller.text),
          child: Text(l10n.saSave),
        ),
      ],
    );
  }
}
