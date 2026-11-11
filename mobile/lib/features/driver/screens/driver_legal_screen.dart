import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/features/driver/legal/driver_legal_provider.dart';
import 'package:angren_taxi/features/driver/legal/legal_save_error.dart';
import 'package:angren_taxi/features/driver/legal/legal_validators.dart';
import 'package:angren_taxi/features/driver/widgets/legal_eligibility_card.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/driver_legal.dart';
import 'package:angren_taxi/shared/models/uz_region.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_skeleton.dart';
import 'package:angren_taxi/shared/widgets/app_text_field.dart';
import 'package:angren_taxi/shared/widgets/error_widget.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

/// HUQUQIY PROFIL — `GET/PATCH /drivers/me/legal` (VMQ 200, PQ-247).
///
/// Tepada xulosa (nima yetishmaydi), pastda forma. Sabab matnlari serverdan;
/// forma tekshiruvi esa server qoidalarining aynan nusxasi
/// ([LegalValidators]).
class DriverLegalScreen extends StatefulWidget {
  const DriverLegalScreen({super.key});

  @override
  State<DriverLegalScreen> createState() => _DriverLegalScreenState();
}

class _DriverLegalScreenState extends State<DriverLegalScreen> {
  final _formKey = GlobalKey<FormState>();
  final _pinfl = TextEditingController();
  final _tin = TextEditingController();
  final _licenceNumber = TextEditingController();
  DriverTaxStatus? _taxStatus;
  DateTime? _birthDate;
  DateTime? _licenceIssuedAt;
  String? _region;
  String? _taxStatusError;
  bool _filled = false;

  /// `LEGAL_PROFILE_DUPLICATE` — qaysi maydon va qaysi qiymat rad etildi
  /// (qiymat o'zgarsa xato yo'qoladi).
  LegalSaveErrorKind? _duplicate;
  String? _duplicateValue;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final provider = context.read<DriverLegalProvider>();
      if (provider.summary != null) _fillFrom(provider.profile);
      await provider.load();
      if (mounted && provider.summary != null) _fillFrom(provider.profile);
    });
  }

  @override
  void dispose() {
    _pinfl.dispose();
    _tin.dispose();
    _licenceNumber.dispose();
    super.dispose();
  }

  /// Forma faqat BIR MARTA serverdan to'ldiriladi — keyingi yuklash
  /// haydovchi yozayotgan matnni o'chirib yubormasin.
  void _fillFrom(DriverLegalProfile p) {
    if (_filled) return;
    _filled = true;
    setState(() {
      _taxStatus = p.taxStatus;
      _pinfl.text = p.pinfl ?? '';
      _tin.text = p.tin ?? '';
      _birthDate = p.birthDate;
      _licenceIssuedAt = p.drivingLicenceIssuedAt;
      _licenceNumber.text = p.taxiLicenceNumber ?? '';
      _region = UzRegion.fromCode(p.taxiLicenceRegion)?.code;
    });
  }

  String? _orNull(String text) {
    final t = text.trim();
    return t.isEmpty ? null : t;
  }

  Future<void> _save(DriverLegalProvider provider) async {
    final statusError = LegalValidators.taxStatus(_taxStatus);
    setState(() => _taxStatusError = statusError);
    final formOk = _formKey.currentState?.validate() ?? false;
    if (!formOk || statusError != null) return;

    final current = provider.profile;
    final region = _region ?? current.taxiLicenceRegion;
    final ok = await provider.save(
      DriverLegalProfile(
        taxStatus: _taxStatus,
        pinfl: _orNull(LegalValidators.normalizeDigits(_pinfl.text)),
        tin: _orNull(LegalValidators.normalizeDigits(_tin.text)),
        birthDate: _birthDate,
        drivingLicenceIssuedAt: _licenceIssuedAt,
        taxiLicenceNumber: _orNull(_licenceNumber.text),
        taxiLicenceRegion: region,
        citizenship: current.citizenship,
      ),
    );
    if (!mounted) return;
    _applySaveError(provider);
    final messenger = ScaffoldMessenger.of(context);
    messenger.showSnackBar(
      SnackBar(
        content: Text(ok ? context.l10n.lglSaved : (provider.saveError ?? '')),
        backgroundColor: ok ? kInk : kErrorDeep,
      ),
    );
  }

  /// Qulf: haydovchi o'zgartirgan qulflangan maydonlar server qiymatiga
  /// qaytariladi (qolganini saqlash mumkin bo'lsin). Takror: maydon ostida
  /// xato.
  void _applySaveError(DriverLegalProvider provider) {
    final kind = provider.saveErrorKind;
    if (kind == LegalSaveErrorKind.locked) {
      final p = provider.profile;
      setState(() {
        _taxStatus = p.taxStatus;
        _pinfl.text = p.pinfl ?? '';
        _tin.text = p.tin ?? '';
        _birthDate = p.birthDate;
        _taxStatusError = null;
      });
      return;
    }
    if (kind == LegalSaveErrorKind.duplicatePinfl ||
        kind == LegalSaveErrorKind.duplicateTin) {
      setState(() {
        _duplicate = kind;
        _duplicateValue = LegalValidators.normalizeDigits(
          kind == LegalSaveErrorKind.duplicatePinfl ? _pinfl.text : _tin.text,
        );
      });
      _formKey.currentState?.validate();
    }
  }

  /// Server rad etgan takror qiymat — o'zgarmaguncha shu xato.
  String? _duplicateError(LegalSaveErrorKind field, String? value) {
    if (_duplicate != field || _duplicateValue == null) return null;
    final normalized = LegalValidators.normalizeDigits(value ?? '');
    return normalized == _duplicateValue ? legalSaveErrorMessage(field) : null;
  }

  Future<void> _pickDate({
    required DateTime? initial,
    required ValueChanged<DateTime> onPicked,
  }) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial ?? DateTime(now.year - 30, now.month, now.day),
      firstDate: DateTime(1940),
      lastDate: now,
    );
    if (picked != null) onPicked(picked);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: kSurface2,
      appBar: AppBar(title: Text(l10n.lglTitle)),
      body: SafeArea(
        top: false,
        child: Consumer<DriverLegalProvider>(
          builder: (context, provider, _) {
            if (provider.summary == null && provider.isLoading) {
              return const AppSkeletonList(itemCount: 5, hasTrailing: false);
            }
            if (provider.summary == null && provider.loadError != null) {
              return AppErrorState(
                message: provider.loadError ?? l10n.lglLoadFailed,
                onRetry: provider.load,
              );
            }
            final locked = provider.isProfileLocked;
            return Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(kSpace4),
                children: [
                  LegalEligibilityCard(
                    eligibility: provider.eligibility,
                    onOpenDocuments: () =>
                        Navigator.of(context).pushNamed('/driver/verification'),
                  ),
                  const SizedBox(height: kSpace4),
                  Text(
                    l10n.lglIntro,
                    style: const TextStyle(
                      fontSize: kFontLabel,
                      color: kInkMuted,
                      height: 1.4,
                    ),
                  ),
                  if (locked) ...[
                    const SizedBox(height: kSpace4),
                    _LockedNote(text: l10n.lglLockedNote),
                  ],
                  const SizedBox(height: kSpace4),
                  _buildTaxStatus(context, locked: locked),
                  const SizedBox(height: kSpace4),
                  AppTextField(
                    key: const ValueKey('legal_pinfl_field'),
                    controller: _pinfl,
                    label: l10n.lglPinfl,
                    hint: l10n.lglPinflHint,
                    enabled: !locked,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(14),
                    ],
                    validator: (v) =>
                        _duplicateError(LegalSaveErrorKind.duplicatePinfl, v) ??
                        LegalValidators.pinfl(v),
                  ),
                  const SizedBox(height: kSpace4),
                  AppTextField(
                    key: const ValueKey('legal_tin_field'),
                    controller: _tin,
                    label: l10n.lglTin,
                    enabled: !locked,
                    hint: _taxStatus == DriverTaxStatus.individualEntrepreneur
                        ? l10n.lglTinHintRequired
                        : l10n.lglTinHintOptional,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(9),
                    ],
                    validator: (v) =>
                        _duplicateError(LegalSaveErrorKind.duplicateTin, v) ??
                        LegalValidators.tin(v, taxStatus: _taxStatus),
                  ),
                  const SizedBox(height: kSpace4),
                  _DateField(
                    key: const ValueKey('legal_birth_date'),
                    label: l10n.lglBirthDate,
                    value: _birthDate,
                    onTap: locked
                        ? null
                        : () => _pickDate(
                              initial: _birthDate,
                              onPicked: (d) => setState(() => _birthDate = d),
                            ),
                  ),
                  const SizedBox(height: kSpace4),
                  _DateField(
                    key: const ValueKey('legal_licence_date'),
                    label: l10n.lglLicenceIssuedAt,
                    value: _licenceIssuedAt,
                    onTap: () => _pickDate(
                      initial: _licenceIssuedAt,
                      onPicked: (d) => setState(() => _licenceIssuedAt = d),
                    ),
                  ),
                  const SizedBox(height: kSpace4),
                  AppTextField(
                    key: const ValueKey('legal_taxi_licence_field'),
                    controller: _licenceNumber,
                    label: l10n.lglTaxiLicenceNumber,
                    hint: 'TL-000123',
                    inputFormatters: [LengthLimitingTextInputFormatter(50)],
                  ),
                  const SizedBox(height: kSpace4),
                  _buildRegion(context, provider.profile.taxiLicenceRegion),
                  const SizedBox(height: kSpace6),
                  AppButton(
                    key: const ValueKey('legal_save_button'),
                    label: l10n.lglSave,
                    height: kControlHeightDriver,
                    isLoading: provider.isSaving,
                    onPressed: provider.isSaving ? null : () => _save(provider),
                  ),
                  const SizedBox(height: kSpace6),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildTaxStatus(BuildContext context, {required bool locked}) {
    final l10n = context.l10n;
    Widget option(DriverTaxStatus status, String label) {
      final selected = _taxStatus == status;
      return Expanded(
        child: ChoiceChip(
          key: ValueKey('legal_tax_${status.wireValue}'),
          label: SizedBox(
            width: double.infinity,
            child: Text(label, textAlign: TextAlign.center, maxLines: 2),
          ),
          selected: selected,
          showCheckmark: false,
          materialTapTargetSize: MaterialTapTargetSize.padded,
          padding: const EdgeInsets.symmetric(vertical: kSpace3),
          selectedColor: kMintTint,
          side: BorderSide(color: selected ? kPrimary : kLineInteractive),
          labelStyle: TextStyle(
            color: kInk,
            fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
          ),
          onSelected: locked
              ? null
              : (_) => setState(() {
                    _taxStatus = status;
                    _taxStatusError = null;
                  }),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          l10n.lglTaxStatus,
          style: const TextStyle(fontWeight: FontWeight.w600, color: kInk),
        ),
        const SizedBox(height: kSpace2),
        Row(
          children: [
            option(DriverTaxStatus.selfEmployed, l10n.lglSelfEmployed),
            const SizedBox(width: kSpace2),
            option(
              DriverTaxStatus.individualEntrepreneur,
              l10n.lglIndividualEntrepreneur,
            ),
          ],
        ),
        if (_taxStatusError != null)
          Padding(
            padding: const EdgeInsets.only(top: kSpace1),
            child: Text(
              _taxStatusError!,
              style: const TextStyle(color: kErrorDeep, fontSize: kFontCaption),
            ),
          ),
      ],
    );
  }

  Widget _buildRegion(BuildContext context, String? serverValue) {
    final l10n = context.l10n;
    final ru = AppL10n.localeName.startsWith('ru');
    // Server hudud KODINI saqlaydi (`UZ-TO`), ko'rsatiladigani — nomi. Eski
    // erkin matn (masalan "Angren") ham tanlov sifatida qoladi — saqlashda
    // yo'qolib ketmasin; o'zgartirilmasa server uni o'zi kodga aylantiradi.
    final legacy = serverValue != null && UzRegion.fromCode(serverValue) == null
        ? serverValue
        : null;
    final options = <(String, String)>[
      for (final r in UzRegion.values) (r.code, r.label(ru: ru)),
      if (legacy != null) (legacy, legacy),
    ];
    return DropdownButtonFormField<String>(
      key: const ValueKey('legal_region_field'),
      value: _region ?? serverValue,
      isExpanded: true,
      decoration: InputDecoration(
        labelText: l10n.lglTaxiLicenceRegion,
        hintText: l10n.lglSelectRegion,
      ),
      items: [
        for (final (value, label) in options)
          DropdownMenuItem(value: value, child: Text(label)),
      ],
      onChanged: (v) => setState(() => _region = v),
    );
  }
}

class _DateField extends StatelessWidget {
  const _DateField({
    super.key,
    required this.label,
    required this.value,
    required this.onTap,
  });

  final String label;
  final DateTime? value;

  /// `null` — faqat o'qish (qulflangan maydon).
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(kRadiusMd),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: label,
          enabled: onTap != null,
          suffixIcon: Icon(
            onTap == null
                ? Icons.lock_outline_rounded
                : Icons.calendar_today_rounded,
          ),
        ),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 24),
          child: Text(
            value == null
                ? context.l10n.lglSelectDate
                : Formatters.formatDate(value!),
            style: TextStyle(
              fontSize: kFontBodyLg,
              color: value == null ? kInkMuted : kInk,
            ),
          ),
        ),
      ),
    );
  }
}

/// Qulflangan profil izohi: maydonlar faqat o'qish uchun.
class _LockedNote extends StatelessWidget {
  const _LockedNote({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const ValueKey('legal_locked_note'),
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLineInteractive),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.lock_outline_rounded, color: kInkMuted, size: 20),
          const SizedBox(width: kSpace2),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: kFontLabel,
                color: kInk,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
