import 'package:angren_taxi/features/superapp/state/promo_code_controller.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/address_details.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

// ============================================================================
// CHECKOUT QO'SHIMCHALARI — promokod va manzil tafsilotlari
// (docs/specs/food-market-ux-v5.md §2–3).
// ============================================================================

/// Oq karta — checkout'dagi boshqa bloklar bilan bir xil yuza.
class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: agSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        boxShadow: agCardShadow,
      ),
      child: child,
    );
  }
}

/// Promokod maydoni: kiritish → "Qo'llash" → chegirma yoki aniq xato.
class PromoCodeField extends StatefulWidget {
  const PromoCodeField({
    super.key,
    required this.controller,
    required this.amount,
    this.enabled = true,
  });

  final PromoCodeController controller;

  /// Promokod tekshiriladigan summa (savat, yetkazishsiz).
  final double amount;
  final bool enabled;

  @override
  State<PromoCodeField> createState() => _PromoCodeFieldState();
}

class _PromoCodeFieldState extends State<PromoCodeField> {
  final TextEditingController _text = TextEditingController();

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _apply() {
    FocusScope.of(context).unfocus();
    widget.controller.apply(_text.text, amount: widget.amount);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return ListenableBuilder(
      listenable: widget.controller,
      builder: (context, _) {
        final promo = widget.controller;
        final applied = promo.isApplied;
        return _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const ExcludeSemantics(
                    child: Icon(Icons.local_offer_rounded, color: agGreenText, size: 20),
                  ),
                  const SizedBox(width: kSpace2),
                  Expanded(
                    child: Text(
                      l10n.saPromoTitle,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        fontSize: kFontBody,
                        color: agText,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: kSpace3),
              if (applied)
                Row(
                  children: [
                    const Icon(Icons.check_circle_rounded, color: agGreenText, size: 20),
                    const SizedBox(width: kSpace2),
                    Expanded(
                      child: Text(
                        l10n.saPromoApplied(promo.appliedCode ?? ''),
                        key: const ValueKey('promo-applied'),
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          fontSize: kFontLabel,
                          color: agGreenText,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: widget.enabled
                          ? () {
                              _text.clear();
                              promo.clear();
                            }
                          : null,
                      child: Text(l10n.saPromoRemove),
                    ),
                  ],
                )
              else
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextField(
                        key: const ValueKey('promo-input'),
                        controller: _text,
                        enabled: widget.enabled && !promo.isValidating,
                        textCapitalization: TextCapitalization.characters,
                        textInputAction: TextInputAction.done,
                        inputFormatters: [LengthLimitingTextInputFormatter(32)],
                        onSubmitted: (_) => _apply(),
                        decoration: InputDecoration(
                          hintText: l10n.saPromoHint,
                          errorText: promo.error,
                          errorMaxLines: 3,
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: kSpace2),
                    SizedBox(
                      height: kControlHeightSm,
                      child: FilledButton(
                        onPressed: widget.enabled && !promo.isValidating ? _apply : null,
                        child: promo.isValidating
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : Text(l10n.saPromoApply),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }
}

/// Podyezd / qavat / xonadon / domofon / mo'ljal / kuryerga izoh.
///
/// Holat [AddressDetailsController] da — checkout uni buyurtma tanasiga
/// qo'shadi va muvaffaqiyatli buyurtmadan keyin keyingi safar uchun eslab
/// qoladi.
class AddressDetailsController {
  AddressDetailsController([AddressDetails? initial]) {
    if (initial != null) fill(initial);
  }

  final entrance = TextEditingController();
  final floor = TextEditingController();
  final apartment = TextEditingController();
  final intercom = TextEditingController();
  final landmark = TextEditingController();
  final courierNote = TextEditingController();

  List<TextEditingController> get _all =>
      [entrance, floor, apartment, intercom, landmark, courierNote];

  bool get isBlank => _all.every((c) => c.text.trim().isEmpty);

  void fill(AddressDetails d) {
    entrance.text = d.entrance ?? '';
    floor.text = d.floor ?? '';
    apartment.text = d.apartment ?? '';
    intercom.text = d.intercom ?? '';
    landmark.text = d.landmark ?? '';
    courierNote.text = d.courierNote ?? '';
  }

  AddressDetails get value => AddressDetails.normalized(
        entrance: entrance.text,
        floor: floor.text,
        apartment: apartment.text,
        intercom: intercom.text,
        landmark: landmark.text,
        courierNote: courierNote.text,
      );

  void dispose() {
    for (final c in _all) {
      c.dispose();
    }
  }
}

class AddressDetailsForm extends StatelessWidget {
  const AddressDetailsForm({
    super.key,
    required this.controller,
    this.prefilled = false,
    this.enabled = true,
  });

  final AddressDetailsController controller;

  /// Oxirgi buyurtmadan to'ldirilganmi — kichik izoh ko'rsatiladi.
  final bool prefilled;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    Widget field(
      TextEditingController c,
      String label,
      int max, {
      String? hint,
      TextInputType? keyboard,
      int maxLines = 1,
      String? key,
    }) {
      return TextField(
        key: key == null ? null : ValueKey(key),
        controller: c,
        enabled: enabled,
        keyboardType: keyboard,
        maxLines: maxLines,
        minLines: 1,
        textInputAction: maxLines > 1 ? TextInputAction.newline : TextInputAction.next,
        inputFormatters: [LengthLimitingTextInputFormatter(max)],
        decoration: InputDecoration(labelText: label, hintText: hint, isDense: true),
      );
    }

    // Uchta qisqa maydon tor ekranda (360dp, matn 1.3x) bir qatorga
    // sig'maydi — kenglikka qarab 3 yoki 2+1 ustun.
    final short = [
      field(controller.entrance, l10n.saAddressEntrance, AddressDetails.entranceMax,
          keyboard: TextInputType.text, key: 'addr-entrance'),
      field(controller.floor, l10n.saAddressFloor, AddressDetails.floorMax,
          keyboard: TextInputType.number, key: 'addr-floor'),
      field(controller.apartment, l10n.saAddressApartment, AddressDetails.apartmentMax,
          keyboard: TextInputType.text, key: 'addr-apartment'),
    ];

    return _Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.saAddressDetailsTitle,
            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: kFontBody, color: agText),
          ),
          const SizedBox(height: 2),
          Text(
            prefilled ? l10n.saAddressDetailsPrefilled : l10n.saAddressDetailsSubtitle,
            style: const TextStyle(fontSize: kFontCaption, color: agSubtle, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: kSpace3),
          LayoutBuilder(
            builder: (context, constraints) {
              final scale = MediaQuery.textScalerOf(context).scale(1);
              final columns = constraints.maxWidth / scale >= 300 ? 3 : 2;
              final width = (constraints.maxWidth - kSpace2 * (columns - 1)) / columns;
              return Wrap(
                spacing: kSpace2,
                runSpacing: kSpace3,
                children: [for (final f in short) SizedBox(width: width, child: f)],
              );
            },
          ),
          const SizedBox(height: kSpace3),
          field(controller.intercom, l10n.saAddressIntercom, AddressDetails.intercomMax, key: 'addr-intercom'),
          const SizedBox(height: kSpace3),
          field(controller.landmark, l10n.saAddressLandmark, AddressDetails.landmarkMax,
              hint: l10n.saAddressLandmarkHint, key: 'addr-landmark'),
          const SizedBox(height: kSpace3),
          field(controller.courierNote, l10n.saAddressCourierNote, AddressDetails.courierNoteMax,
              hint: l10n.saAddressCourierNoteHint, maxLines: 3, key: 'addr-note'),
        ],
      ),
    );
  }
}
