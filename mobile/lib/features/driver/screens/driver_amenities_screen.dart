import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/driver_provider.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/trip_option.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Haydovchi taklif qila oladigan safar opsiyalari.
///
/// ⚠️ Bu yerda belgilangan narsa matching FILTRI: "bola o'rindig'i" ni
/// yoqqan haydovchiga o'rindiq so'ragan yo'lovchilar yuboriladi. Shuning
/// uchun pastda ogohlantirish bor — yo'q narsani belgilash shikoyatga olib
/// keladi.
class DriverAmenitiesScreen extends StatefulWidget {
  const DriverAmenitiesScreen({super.key});

  @override
  State<DriverAmenitiesScreen> createState() => _DriverAmenitiesScreenState();
}

class _DriverAmenitiesScreenState extends State<DriverAmenitiesScreen> {
  late final Set<TripOption> _selected = {
    ...?context.read<DriverProvider>().driver?.amenities,
  };
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    final error = await context.read<DriverProvider>().updateAmenities(
          TripOption.values.where(_selected.contains).toList(),
        );
    if (!mounted) return;
    setState(() {
      _saving = false;
      _error = error;
    });
    if (error == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(context.l10n.drvSaved)),
      );
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(context.l10n.drvAmenitiesTitle)),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(kSpace4),
          children: [
            Text(
              context.l10n.drvAmenitiesIntro,
              style: const TextStyle(color: kInkMuted, height: 1.4),
            ),
            const SizedBox(height: kSpace3),
            for (final option in TripOption.values)
              SwitchListTile(
                key: ValueKey('amenity-${option.apiValue}'),
                contentPadding: EdgeInsets.zero,
                secondary: Icon(option.icon, color: kInkMuted),
                title: Text(option.label),
                value: _selected.contains(option),
                onChanged: (on) => setState(() {
                  if (on) {
                    _selected.add(option);
                  } else {
                    _selected.remove(option);
                  }
                }),
              ),
            const SizedBox(height: kSpace3),
            Container(
              padding: const EdgeInsets.all(kSpace3),
              decoration: BoxDecoration(
                color: kWarningLight,
                borderRadius: BorderRadius.circular(kRadiusSm),
              ),
              child: Text(
                context.l10n.drvAmenitiesWarning,
                style: const TextStyle(color: kWarningDeep, fontSize: kFontLabel, height: 1.35),
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: kSpace3),
              Text(_error!, style: const TextStyle(color: kErrorDeep)),
            ],
            const SizedBox(height: kSpace4),
            AppButton(
              label: context.l10n.drvSave,
              isLoading: _saving,
              onPressed: _saving ? null : _save,
            ),
          ],
        ),
      ),
    );
  }
}
