import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/widgets/app_text_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

/// Yuk og'irligi chegarasi, kg (backend `details.weightKg` 1..20000).
const int kCargoMaxWeightKg = 20000;

/// Yuk ortuvchilar soni chegarasi (backend `details.loaders` 0..10).
const int kCargoMaxLoaders = 10;

/// Ixtiyoriy butun son maydoni: bo'sh — `null`, chegaradan tashqari yoki
/// yaroqsiz — [kCargoInvalidInput]. Server noto'g'ri qiymatni 400 bilan rad etadi,
/// shuning uchun ilova uni oldindan to'xtatadi.
const int kCargoInvalidInput = -1;
int? parseOptionalInt(String raw, {required int min, required int max}) {
  final text = raw.trim();
  if (text.isEmpty) return null;
  final value = int.tryParse(text);
  if (value == null || value < min || value > max) return kCargoInvalidInput;
  return value;
}

/// Buyurtmaga ketadigan cargo `details` (bo'sh maydonlar yuborilmaydi).
Map<String, dynamic> buildCargoDetails({
  required String vehicle,
  int? weightKg,
  int? loaders,
}) =>
    {
      'vehicle': vehicle,
      if (weightKg != null) 'weightKg': weightKg,
      if (loaders != null) 'loaders': loaders,
    };

class CargoScreen extends StatefulWidget {
  const CargoScreen({super.key});

  @override
  State<CargoScreen> createState() => _CargoScreenState();
}

class _CargoScreenState extends State<CargoScreen> {
  int _selected = 0;
  final _formKey = GlobalKey<FormState>();
  final _weight = TextEditingController();
  final _loaders = TextEditingController();

  @override
  void dispose() {
    _weight.dispose();
    _loaders.dispose();
    super.dispose();
  }

  // $2 is the wire value sent as `cargoDetails.vehicle` — never localize it.
  // What the user sees comes from [_typeLabels].
  static const _types = [
    (Icons.sports_motorsports_rounded, 'Kuryer'),
    (Icons.airport_shuttle_rounded, 'Yengil'),
    (Icons.local_shipping_rounded, 'Yuk'),
  ];

  /// Display title and capacity caption for `_types[i]`.
  static (String, String) _typeLabels(BuildContext context, int i) {
    final l10n = context.l10n;
    return switch (i) {
      0 => (l10n.saCargoCourier, l10n.saCargoUpTo5kg),
      1 => (l10n.saCargoLight, l10n.saCargoUpTo300kg),
      _ => (l10n.saCargoTruck, l10n.saCargoUpTo1t),
    };
  }

  void _callCourier() {
    // Cargo is backend-supported — hand off to the shared booking flow, which
    // owns address selection and the real distance-based quote. The selected
    // vehicle type travels with the order instead of being thrown away.
    if (!(_formKey.currentState?.validate() ?? false)) return;
    context.read<OrderProvider>().setServiceType(
          'cargo',
          details: buildCargoDetails(
            vehicle: _types[_selected].$2,
            weightKg: parseOptionalInt(_weight.text, min: 1, max: kCargoMaxWeightKg),
            loaders: parseOptionalInt(_loaders.text, min: 0, max: kCargoMaxLoaders),
          ),
        );
    Navigator.of(context).pushNamed('/passenger/home');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: context.l10n.saCargoTitle,
            subtitle: context.l10n.saCargoSubtitle,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
              padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
              children: [

                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: Text(context.l10n.saCargoVehicleType,
                      style: const TextStyle(
                          fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText)),
                ),
                const SizedBox(height: kSpace3),
                Row(
                  children: [
                    for (var i = 0; i < _types.length; i++) ...[
                      if (i != 0) const SizedBox(width: kSpace3),
                      Expanded(
                        child: Semantics(
                          button: true,
                          selected: _selected == i,
                          child: GestureDetector(
                            onTap: () => setState(() => _selected = i),
                            behavior: HitTestBehavior.opaque,
                            child: _TypeCard(
                              icon: _types[i].$1,
                              title: _typeLabels(context, i).$1,
                              sub: _typeLabels(context, i).$2,
                              active: _selected == i,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: kSpace4),
                // Ixtiyoriy: og'irlik va yuk ortuvchilar — haydovchi
                // taklifda ko'radi (INCIDENT-POLICY §2, cargo details).
                AppTextField(
                  key: const ValueKey('cargo_weight'),
                  controller: _weight,
                  label: context.l10n.saCargoWeight,
                  hint: context.l10n.saCargoWeightRange,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  prefixIcon: const Icon(Icons.scale_rounded),
                  validator: (v) =>
                      parseOptionalInt(v ?? '', min: 1, max: kCargoMaxWeightKg) == kCargoInvalidInput
                          ? context.l10n.saCargoWeightRange
                          : null,
                ),
                const SizedBox(height: kSpace3),
                AppTextField(
                  key: const ValueKey('cargo_loaders'),
                  controller: _loaders,
                  label: context.l10n.saCargoLoaders,
                  hint: context.l10n.saCargoLoadersRange,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  prefixIcon: const Icon(Icons.groups_rounded),
                  validator: (v) =>
                      parseOptionalInt(v ?? '', min: 0, max: kCargoMaxLoaders) == kCargoInvalidInput
                          ? context.l10n.saCargoLoadersRange
                          : null,
                ),
                const SizedBox(height: kSpace4),
                Container(
                  padding: const EdgeInsets.all(kSpace4),
                  decoration: BoxDecoration(
                    color: agSurface,
                    borderRadius: BorderRadius.circular(kRadiusLg),
                    boxShadow: agCardShadow,
                  ),
                  child: Row(
                    children: [
                      const ExcludeSemantics(
                        child: Icon(Icons.info_outline_rounded,
                            size: 22, color: agSubtle),
                      ),
                      const SizedBox(width: kSpace3),
                      Expanded(
                        child: Text(
                          context.l10n.saCargoAddressHint,
                          style: const TextStyle(
                            fontSize: kFontCaption,
                            color: agSubtle,
                            fontWeight: FontWeight.w600,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
                kSpace4, 0, kSpace4, MediaQuery.of(context).padding.bottom + kSpace4),
            child: AgPrimaryButton(label: context.l10n.saCargoCallCourier, onPressed: _callCourier),
          ),
        ],
      ),
    );
  }

}

class _TypeCard extends StatelessWidget {
  const _TypeCard({required this.icon, required this.title, required this.sub, required this.active});
  final IconData icon;
  final String title;
  final String sub;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: kMinTapTarget),
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: active ? agTint : agSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: active ? agPrimary : agDivider, width: 1.5),
        boxShadow: active ? agSoftShadow : null,
      ),
      child: Column(
        children: [
          ExcludeSemantics(
            child: Icon(icon, size: 30, color: active ? agPrimary : agSubtle),
          ),
          const SizedBox(height: kSpace2),
          Text(title,
              style: TextStyle(
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w800,
                  color: active ? agGreenText : agText)),
          Text(sub,
              style: const TextStyle(
                  fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
