import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:angren_taxi/shared/models/parcel_info.dart';
import 'package:angren_taxi/shared/utils/validators.dart';
import 'package:angren_taxi/shared/widgets/app_text_field.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Posilka (2-versiya): kimga, nima, qanday o'lchamda. Manzil va narx esa
/// umumiy buyurtma oqimida — yuk tashish ([CargoScreen]) bilan bir xil yo'l.
class ParcelScreen extends StatefulWidget {
  const ParcelScreen({super.key});

  @override
  State<ParcelScreen> createState() => _ParcelScreenState();
}

class _ParcelScreenState extends State<ParcelScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController(text: '+998');
  final _name = TextEditingController();
  final _what = TextEditingController();
  String _size = kParcelSizeSmall;

  @override
  void dispose() {
    _phone.dispose();
    _name.dispose();
    _what.dispose();
    super.dispose();
  }

  static (IconData, String, String) _sizeLabels(BuildContext context, String size) {
    final l10n = context.l10n;
    return switch (size) {
      kParcelSizeMedium => (Icons.shopping_bag_rounded, l10n.saParcelSizeMedium, l10n.saParcelSizeMediumHint),
      kParcelSizeLarge => (Icons.luggage_rounded, l10n.saParcelSizeLarge, l10n.saParcelSizeLargeHint),
      _ => (Icons.key_rounded, l10n.saParcelSizeSmall, l10n.saParcelSizeSmallHint),
    };
  }

  void _continue() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final parcel = ParcelInfo(
      recipientPhone: Validators.normalizePhone(_phone.text),
      recipientName: _name.text.trim(),
      itemDescription: _what.text.trim(),
      size: _size,
    );
    // Same hand-off as cargo: the shared booking flow owns addresses and the
    // real quote; the parcel payload travels with the order.
    context.read<OrderProvider>().setServiceType(kServiceTypeParcel, details: parcel.toDetails());
    Navigator.of(context).pushNamed('/passenger/home');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: agBg,
      body: Column(
        children: [
          AgHeader(
            title: l10n.saParcelTitle,
            subtitle: l10n.saParcelSubtitle,
            onBack: () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(kSpace4, kSpace4, kSpace4, kSpace6),
                children: [
                  AppTextField(
                    controller: _phone,
                    label: l10n.saParcelRecipientPhone,
                    hint: '+998XXXXXXXXX',
                    keyboardType: TextInputType.phone,
                    textInputAction: TextInputAction.next,
                    prefixIcon: const Icon(Icons.phone_rounded),
                    validator: Validators.validatePhone,
                  ),
                  const SizedBox(height: kSpace3),
                  AppTextField(
                    controller: _name,
                    label: l10n.saParcelRecipientName,
                    hint: l10n.saParcelRecipientName,
                    textInputAction: TextInputAction.next,
                    prefixIcon: const Icon(Icons.person_rounded),
                  ),
                  const SizedBox(height: kSpace3),
                  AppTextField(
                    controller: _what,
                    label: l10n.saParcelWhat,
                    hint: l10n.saParcelWhatHint,
                    textInputAction: TextInputAction.done,
                    prefixIcon: const Icon(Icons.inventory_2_rounded),
                    maxLines: 2,
                    validator: (v) => (v == null || v.trim().isEmpty) ? l10n.saParcelWhatRequired : null,
                  ),
                  const SizedBox(height: kSpace5),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Text(l10n.saParcelSize,
                        style: const TextStyle(
                            fontSize: kFontTitle, fontWeight: FontWeight.w800, color: agText)),
                  ),
                  const SizedBox(height: kSpace3),
                  Row(
                    children: [
                      for (var i = 0; i < kParcelSizes.length; i++) ...[
                        if (i != 0) const SizedBox(width: kSpace3),
                        Expanded(
                          child: Semantics(
                            button: true,
                            selected: _size == kParcelSizes[i],
                            child: GestureDetector(
                              onTap: () => setState(() => _size = kParcelSizes[i]),
                              behavior: HitTestBehavior.opaque,
                              child: _SizeCard(
                                labels: _sizeLabels(context, kParcelSizes[i]),
                                active: _size == kParcelSizes[i],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: kSpace4),
                  Container(
                    padding: const EdgeInsets.all(kSpace4),
                    decoration: BoxDecoration(
                      color: agTint,
                      borderRadius: BorderRadius.circular(kRadiusLg),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const ExcludeSemantics(
                          child: Icon(Icons.pin_rounded, size: 22, color: agPrimary),
                        ),
                        const SizedBox(width: kSpace3),
                        Expanded(
                          child: Text(
                            l10n.saParcelPinInfo,
                            style: const TextStyle(
                              fontSize: kFontCaption,
                              color: agGreenText,
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
            child: AgPrimaryButton(label: l10n.saParcelContinue, onPressed: _continue),
          ),
        ],
      ),
    );
  }
}

class _SizeCard extends StatelessWidget {
  const _SizeCard({required this.labels, required this.active});
  final (IconData, String, String) labels;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: kMinTapTarget),
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: active ? agTint : agSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: active ? agPrimary : agDivider, width: 1.5),
        boxShadow: active ? agSoftShadow : null,
      ),
      child: Column(
        children: [
          ExcludeSemantics(child: Icon(labels.$1, size: 28, color: active ? agPrimary : agSubtle)),
          const SizedBox(height: kSpace2),
          Text(labels.$2,
              style: TextStyle(
                  fontSize: kFontLabel,
                  fontWeight: FontWeight.w800,
                  color: active ? agGreenText : agText)),
          Text(labels.$3,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: kFontMicro, color: agSubtle, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}
