import 'dart:async';

import 'package:angren_taxi/core/network/api_error.dart';
import 'package:angren_taxi/core/payments/saved_cards_service.dart';
import 'package:angren_taxi/features/payments/state/saved_cards_provider.dart';
import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/saved_card.dart';
import 'package:angren_taxi/shared/widgets/ag_map_fab.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

/// 16 raqam, har 4 tadan keyin bo'shliq (`8600 1234 5678 9012`).
class CardNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final clipped = digits.length > 16 ? digits.substring(0, 16) : digits;
    final buffer = StringBuffer();
    for (var i = 0; i < clipped.length; i++) {
      if (i > 0 && i % 4 == 0) buffer.write(' ');
      buffer.write(clipped[i]);
    }
    final text = buffer.toString();
    return TextEditingValue(
        text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

/// `MM/YY` — ikkinchi raqamdan keyin `/` o'zi qo'yiladi.
class CardExpiryFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
      TextEditingValue oldValue, TextEditingValue newValue) {
    final digits = newValue.text.replaceAll(RegExp(r'\D'), '');
    final clipped = digits.length > 4 ? digits.substring(0, 4) : digits;
    final text = clipped.length > 2
        ? '${clipped.substring(0, 2)}/${clipped.substring(2)}'
        : clipped;
    return TextEditingValue(
        text: text, selection: TextSelection.collapsed(offset: text.length));
  }
}

/// Faqat raqamlar, 16 ta bo'lsa.
String? normalizeCardNumber(String input) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  return digits.length == 16 ? digits : null;
}

/// `MM/YY` → Payme `MMYY`; oy 01–12 bo'lmasa `null`.
String? normalizeCardExpiry(String input) {
  final digits = input.replaceAll(RegExp(r'\D'), '');
  if (digits.length != 4) return null;
  final month = int.tryParse(digits.substring(0, 2)) ?? 0;
  return month >= 1 && month <= 12 ? digits : null;
}

enum _Step { details, code }

/// Karta bog'lash: raqam + muddat → Payme SMS kodi → tasdiq → serverga token.
///
/// Karta raqami faqat shu ekran xotirasida va to'g'ridan-to'g'ri Payme'ga
/// ketadi; ekran yopilganda maydonlar tozalanadi. Muvaffaqiyatda
/// qo'shilgan [SavedCard] bilan `pop` qiladi.
class AddCardScreen extends StatefulWidget {
  const AddCardScreen({super.key});

  @override
  State<AddCardScreen> createState() => _AddCardScreenState();
}

class _AddCardScreenState extends State<AddCardScreen> {
  final _numberController = TextEditingController();
  final _expiryController = TextEditingController();
  final _codeController = TextEditingController();
  final _detailsKey = GlobalKey<FormState>();
  final _codeKey = GlobalKey<FormState>();

  _Step _step = _Step.details;
  bool _busy = false;
  String? _error;
  String? _token;
  String _sentTo = '';
  int _resendSeconds = 0;
  Timer? _resendTimer;

  SavedCardsProvider get _provider => context.read<SavedCardsProvider>();
  SavedCardsService get _service => _provider.service;
  SavedCardsAvailability get _config => _provider.availability;

  @override
  void dispose() {
    _resendTimer?.cancel();
    // Karta ma'lumoti xotirada qolmasin.
    _numberController
      ..clear()
      ..dispose();
    _expiryController
      ..clear()
      ..dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submitDetails() async {
    if (!(_detailsKey.currentState?.validate() ?? false)) return;
    final number = normalizeCardNumber(_numberController.text)!;
    final expire = normalizeCardExpiry(_expiryController.text)!;
    await _run(() async {
      final token = await _service.paymeCreateCard(_config,
          number: number, expire: expire);
      final sent = await _service.paymeSendCode(_config, token);
      if (!mounted) return;
      setState(() {
        _token = token;
        _sentTo = sent.phone;
        _step = _Step.code;
      });
      _startResendTimer(sent.wait);
    });
  }

  Future<void> _resend() async {
    final token = _token;
    if (token == null) return;
    await _run(() async {
      final sent = await _service.paymeSendCode(_config, token);
      if (!mounted) return;
      setState(() => _sentTo = sent.phone);
      _startResendTimer(sent.wait);
    });
  }

  Future<void> _submitCode() async {
    if (!(_codeKey.currentState?.validate() ?? false)) return;
    final token = _token;
    if (token == null) return;
    await _run(() async {
      final verified = await _service.paymeVerify(_config,
          token: token, code: _codeController.text.trim());
      final card = await _service.save(verified);
      if (!mounted) return;
      _provider.addCard(card);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(context.l10n.addCardSuccess)));
      Navigator.of(context).pop(card);
    });
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on SavedCardsException catch (e) {
      if (mounted) setState(() => _error = _messageFor(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String _messageFor(SavedCardsException e) {
    final l10n = context.l10n;
    return switch (e.code) {
      ApiErrorCode.savedCardInvalid => l10n.cardsErrInvalid,
      ApiErrorCode.savedCardLimit => l10n.cardsErrLimit(5),
      ApiErrorCode.savedCardsUnavailable => l10n.cardsErrUnavailable,
      _ => e.message,
    };
  }

  void _startResendTimer(Duration wait) {
    _resendTimer?.cancel();
    setState(() => _resendSeconds = wait.inSeconds.clamp(0, 300));
    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _resendSeconds <= 1) {
        timer.cancel();
        if (mounted) setState(() => _resendSeconds = 0);
        return;
      }
      setState(() => _resendSeconds -= 1);
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Scaffold(
      backgroundColor: agSurface2,
      body: Column(
        children: [
          AgHeader(
            title: _step == _Step.details
                ? l10n.addCardTitle
                : l10n.addCardCodeTitle,
            onBack: _busy ? null : () => Navigator.of(context).pop(),
          ),
          Expanded(
            child: ListView(
              padding:
                  const EdgeInsets.fromLTRB(kSpace4, kSpace5, kSpace4, kSpace6),
              children: [
                AgSurfaceCard(
                    child: _step == _Step.details
                        ? _buildDetails()
                        : _buildCode()),
                if (_error != null) ...[
                  const SizedBox(height: kSpace3),
                  Text(
                    _error!,
                    key: const Key('add-card-error'),
                    style: const TextStyle(
                        color: agRed,
                        fontWeight: FontWeight.w600,
                        fontSize: kFontCaption),
                  ),
                ],
                const SizedBox(height: kSpace4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const ExcludeSemantics(
                        child: Icon(Icons.lock_rounded,
                            size: 18, color: agSubtle)),
                    const SizedBox(width: kSpace2),
                    Expanded(
                      child: Text(
                        l10n.addCardSecureNote,
                        style: const TextStyle(
                            fontSize: kFontCaption,
                            color: agSubtle,
                            fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetails() {
    final l10n = context.l10n;
    return Form(
      key: _detailsKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            key: const Key('add-card-number'),
            controller: _numberController,
            enabled: !_busy,
            autofocus: true,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.creditCardNumber],
            inputFormatters: [CardNumberFormatter()],
            decoration: InputDecoration(
                labelText: l10n.addCardNumberLabel,
                hintText: '8600 0000 0000 0000'),
            validator: (v) => normalizeCardNumber(v ?? '') == null
                ? l10n.addCardNumberInvalid
                : null,
          ),
          const SizedBox(height: kSpace3),
          TextFormField(
            key: const Key('add-card-expiry'),
            controller: _expiryController,
            enabled: !_busy,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.creditCardExpirationDate],
            inputFormatters: [CardExpiryFormatter()],
            decoration: InputDecoration(
                labelText: l10n.addCardExpiryLabel, hintText: '12/29'),
            validator: (v) => normalizeCardExpiry(v ?? '') == null
                ? l10n.addCardExpiryInvalid
                : null,
          ),
          const SizedBox(height: kSpace4),
          AppButton(
            key: const Key('add-card-continue'),
            label: l10n.addCardContinue,
            isLoading: _busy,
            onPressed: _busy ? null : _submitDetails,
          ),
        ],
      ),
    );
  }

  Widget _buildCode() {
    final l10n = context.l10n;
    return Form(
      key: _codeKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_sentTo.isNotEmpty)
            Text(
              l10n.addCardCodeSentTo(_sentTo),
              style: const TextStyle(
                  fontSize: kFontBody,
                  color: agText,
                  fontWeight: FontWeight.w600),
            ),
          const SizedBox(height: kSpace3),
          TextFormField(
            key: const Key('add-card-code'),
            controller: _codeController,
            enabled: !_busy,
            autofocus: true,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.oneTimeCode],
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(8)
            ],
            decoration: InputDecoration(labelText: l10n.addCardCodeLabel),
            validator: (v) =>
                (v ?? '').trim().length < 4 ? l10n.addCardCodeInvalid : null,
          ),
          const SizedBox(height: kSpace4),
          AppButton(
            key: const Key('add-card-confirm'),
            label: l10n.addCardConfirm,
            isLoading: _busy,
            onPressed: _busy ? null : _submitCode,
          ),
          const SizedBox(height: kSpace2),
          TextButton(
            onPressed: _busy || _resendSeconds > 0 ? null : _resend,
            child: Text(_resendSeconds > 0
                ? l10n.addCardResendIn(_resendSeconds)
                : l10n.addCardResend),
          ),
        ],
      ),
    );
  }
}
