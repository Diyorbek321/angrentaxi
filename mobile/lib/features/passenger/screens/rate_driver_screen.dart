import 'package:angren_taxi/core/config/app_haptics.dart';
import 'package:angren_taxi/core/config/app_responsive.dart';
import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/core/di/service_locator.dart';
import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/features/passenger/order_provider.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:angren_taxi/shared/widgets/app_button.dart';
import 'package:angren_taxi/shared/widgets/app_pressable.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

class RateDriverScreen extends StatefulWidget {
  const RateDriverScreen({
    super.key,
    required this.orderId,
    required this.driverName,
  });

  final String orderId;
  final String driverName;

  @override
  State<RateDriverScreen> createState() => _RateDriverScreenState();
}

class _RateDriverScreenState extends State<RateDriverScreen>
    with TickerProviderStateMixin {
  /// Chegaralar backend'dagi `AddTipDto` bilan bir xil (`@Min(1000)`,
  /// `@Max(200000)`). Bu yerda takrorlanishining sababi: noto'g'ri summani
  /// so'rov yuborilmasdan OLDIN aytish — tarmoqqa chiqib 400 olishdan
  /// ko'ra tezroq va tushunarliroq.
  static const int _tipMin = 1000;
  static const int _tipMax = 200000;

  /// Tayyor summalar. Angren uchun tipik yo'l haqi 15–25 ming so'm bo'lgani
  /// uchun chaqim shu miqyosda: taxminan 10% / 25% / 50%.
  static const List<int> _tipPresets = [2000, 5000, 10000];

  int _selectedScore = 0;
  final TextEditingController _commentController = TextEditingController();
  bool _isLoading = false;
  final List<AnimationController> _starControllers = [];
  final List<Animation<double>> _starScales = [];

  /// Tanlangan tayyor summa. `null` — chaqim tanlanmagan (ixtiyoriy).
  int? _selectedTip;

  /// "Boshqa" ochiqmi — ochiq bo'lsa summa maydondan olinadi.
  bool _customTipOpen = false;
  final TextEditingController _customTipController = TextEditingController();

  /// Mahalliy validatsiya xatosi (chegaradan chiqqan summa).
  String? _tipFieldError;

  /// Serverdan kelgan xato matni.
  String? _tipSubmitError;

  /// 409 — bu safarga chaqim allaqachon yozilgan. Qayta urinish foydasiz,
  /// shuning uchun tanlov butunlay yopiladi.
  bool _tipLocked = false;

  /// Baho serverga yetib borgan bo'lsa, chaqim xatosidan keyingi qayta
  /// urinishda uni IKKINCHI MARTA yubormaslik uchun.
  bool _ratingSubmitted = false;

  @override
  void initState() {
    super.initState();
    for (int i = 0; i < 5; i++) {
      final controller = AnimationController(
        duration: const Duration(milliseconds: 150),
        vsync: this,
      );
      final scale = Tween<double>(begin: 1.0, end: 1.3).animate(
        CurvedAnimation(parent: controller, curve: Curves.easeOutBack),
      );
      _starControllers.add(controller);
      _starScales.add(scale);
    }
  }

  @override
  void dispose() {
    _commentController.dispose();
    _customTipController.dispose();
    for (final c in _starControllers) {
      c.dispose();
    }
    super.dispose();
  }

  void _onStarTapped(int index) {
    final newScore = index + 1;
    setState(() => _selectedScore = newScore);

    // Animate all stars up to and including the tapped one.
    for (int i = 0; i < 5; i++) {
      if (i <= index) {
        _starControllers[i].forward().then((_) => _starControllers[i].reverse());
      }
    }
  }

  // ---------------------------------------------------------------------
  // Chaqim tanlovi
  // ---------------------------------------------------------------------

  /// Yuboriladigan summa. `null` — chaqim yo'q (bu XATO EMAS, ixtiyoriy).
  int? get _tipAmount {
    if (_tipLocked) return null;
    if (_customTipOpen) {
      final digits = _customTipController.text.replaceAll(RegExp(r'\D'), '');
      return digits.isEmpty ? null : int.tryParse(digits);
    }
    return _selectedTip;
  }

  void _selectPreset(int amount) {
    setState(() {
      // Ikkinchi marta bosish tanlovni bekor qiladi — chaqimdan voz kechish
      // uchun ekranni tark etish shart emas.
      _selectedTip = _selectedTip == amount ? null : amount;
      _customTipOpen = false;
      _tipFieldError = null;
      _tipSubmitError = null;
    });
  }

  void _toggleCustom() {
    setState(() {
      _customTipOpen = !_customTipOpen;
      _selectedTip = null;
      _tipFieldError = null;
      _tipSubmitError = null;
    });
  }

  /// "Boshqa" summasi chegaraga tushadimi. Tayyor summalar har doim to'g'ri,
  /// shuning uchun ular tekshirilmaydi.
  bool _validateCustomTip() {
    if (!_customTipOpen) return true;

    // ⚠️ BO'SH MAYDON XATO EMAS — u "chaqim yo'q" degani. Chaqim ixtiyoriy,
    // baho esa ekranning asosiy maqsadi: "Boshqa" ni ochib fikridan qaytgan
    // foydalanuvchi bahosini umuman yubora olmay qolsa, ixtiyoriy qadam
    // majburiy to'siqqa aylanadi.
    if (_customTipController.text.replaceAll(RegExp(r'\D'), '').isEmpty) {
      return true;
    }

    final amount = _tipAmount;
    if (amount == null || amount < _tipMin || amount > _tipMax) {
      setState(() {
        _tipFieldError = 'Chaqim ${Formatters.formatAmount(_tipMin.toDouble())}'
            ' dan ${Formatters.formatSom(_tipMax.toDouble())}gacha bo\'lishi kerak';
      });
      AppHaptics.error();
      return false;
    }
    return true;
  }

  // ---------------------------------------------------------------------
  // Yuborish
  // ---------------------------------------------------------------------

  Future<void> _submit() async {
    if (_selectedScore == 0) {
      AppHaptics.error();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Iltimos, baho bering')),
      );
      return;
    }
    if (!_validateCustomTip()) return;

    final orderProvider = context.read<OrderProvider>();
    final messenger = ScaffoldMessenger.of(context);
    final tipAmount = _tipAmount;

    setState(() {
      _isLoading = true;
      _tipSubmitError = null;
    });

    try {
      // Baho AVVAL yuboriladi: chaqim ixtiyoriy qo'shimcha, baho esa asosiy
      // maqsad. Chaqim xato bersa ham baho saqlanib qoladi.
      if (!_ratingSubmitted) {
        final apiClient = sl<ApiClient>();
        await apiClient.post(
          ApiEndpoints.submitRating,
          data: {
            'orderId': widget.orderId,
            'score': _selectedScore,
            if (_commentController.text.trim().isNotEmpty)
              'comment': _commentController.text.trim(),
          },
        );
        _ratingSubmitted = true;
      }

      if (tipAmount != null) {
        final sent = await orderProvider.addTip(
          orderId: widget.orderId,
          amount: tipAmount,
        );
        if (!sent) {
          AppHaptics.error();
          if (!mounted) return;
          setState(() {
            _tipSubmitError = orderProvider.tipError;
            _tipLocked = orderProvider.isTipAlreadyGiven;
            _isLoading = false;
          });
          return;
        }
      }

      AppHaptics.success();
      if (!mounted) return;
      messenger.showSnackBar(
        SnackBar(
          content: Text(
            tipAmount == null
                ? 'Bahoyingiz uchun rahmat!'
                : '${Formatters.formatSom(tipAmount.toDouble())} chaqim '
                    'haydovchiga yuborildi. Rahmat!',
          ),
        ),
      );
      Navigator.of(context).pop();
    } catch (e) {
      AppHaptics.error();
      if (mounted) {
        messenger.showSnackBar(
          SnackBar(content: Text(extractErrorMessage(e))),
        );
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final avatarLetter =
        widget.driverName.isNotEmpty ? widget.driverName[0].toUpperCase() : '?';
    // 320dp ekranda 24dp chetki bo'shliq kontentni siqib qo'yadi — tor
    // sinfda gutter kichrayadi.
    final sidePadding = context.isTight ? kSpace4 : kSpace6;

    return Scaffold(
      backgroundColor: kBackground,
      body: SafeArea(
        // ⚠️ Chaqim bloki qo'shilgach ustun 320x568 ekranga (yoki katta tizim
        // shriftiga) sig'maydi. `Spacer` esa aylantiriladigan ustunda
        // ishlamaydi, chunki cheksiz balandlikda "bo'sh joy" yo'q. Yechim:
        // minimal balandlik = ekran balandligi + `IntrinsicHeight` — baland
        // ekranda tugmalar pastda qoladi, past ekranda kontent aylantiriladi.
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: IntrinsicHeight(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(
                      sidePadding,
                      kSpace8,
                      sidePadding,
                      kSpace6,
                    ),
                    child: Column(
                      children: [
                        // Avatar — mint dekorativ to'ldirish, ustidagi harf ink
                        // (7.84:1), hech qachon oq (2.12:1).
                        ExcludeSemantics(
                          child: Container(
                            width: 80,
                            height: 80,
                            decoration: const BoxDecoration(
                              color: kMint,
                              shape: BoxShape.circle,
                            ),
                            alignment: Alignment.center,
                            child: Text(
                              avatarLetter,
                              style: const TextStyle(
                                fontSize: kFontDisplay,
                                fontWeight: FontWeight.w800,
                                color: kOnMint,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: kSpace4),
                        Text(
                          widget.driverName,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: kFontH1,
                            fontWeight: FontWeight.w800,
                            color: kInk,
                          ),
                        ),
                        const SizedBox(height: kSpace1 + 2),
                        const Text(
                          'Sayohat qanday kechdi?',
                          style:
                              TextStyle(fontSize: kFontTitle, color: kInkMuted),
                        ),
                        const SizedBox(height: kSpace6),

                        // Star selector — har bir yulduz 48x48 tegish maydoni
                        // va "N yulduz" yorlig'i bilan.
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(5, (i) {
                            final filled = i < _selectedScore;
                            return Semantics(
                              button: true,
                              selected: filled,
                              label: '${i + 1} yulduz',
                              excludeSemantics: true,
                              child: GestureDetector(
                                onTap: () => _onStarTapped(i),
                                behavior: HitTestBehavior.opaque,
                                child: ConstrainedBox(
                                  constraints: const BoxConstraints(
                                    minHeight: kMinTapTarget,
                                    minWidth: kMinTapTarget,
                                  ),
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: kSpace1 + 2),
                                    child: ScaleTransition(
                                      scale: _starScales[i],
                                      child: Icon(
                                        filled
                                            ? Icons.star_rounded
                                            : Icons.star_outline_rounded,
                                        // Reyting ma'no tashiydi — yorug'
                                        // fonda ko'rinadigan mint kMintDeep
                                        // bo'lishi shart.
                                        color: filled ? kMintDeep : kInkSubtle,
                                        size: 40,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ),
                        const SizedBox(height: kSpace2),
                        Text(
                          _ratingLabel(_selectedScore),
                          style: const TextStyle(
                            fontSize: kFontLabel,
                            fontWeight: FontWeight.w600,
                            color: kInkMuted,
                          ),
                        ),
                        const SizedBox(height: kSpace6),

                        // Comment field
                        TextField(
                          controller: _commentController,
                          maxLength: 500,
                          maxLines: 3,
                          decoration: InputDecoration(
                            filled: true,
                            fillColor: kSurface2,
                            hintText: 'Haydovchi haqida izoh...',
                            hintStyle: const TextStyle(color: kInkMuted),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(kRadiusMd),
                              borderSide: BorderSide.none,
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(kRadiusMd),
                              borderSide:
                                  const BorderSide(color: kPrimary, width: 2),
                            ),
                            contentPadding: const EdgeInsets.all(kSpace4),
                            counterStyle: const TextStyle(color: kInkMuted),
                          ),
                        ),
                        const SizedBox(height: kSpace4),

                        _buildTipSection(),

                        const Spacer(),
                        const SizedBox(height: kSpace5),

                        // Submit button
                        AppButton(
                          label: _primaryLabel,
                          onPressed: _submit,
                          isLoading: _isLoading,
                          semanticsLabel: _primarySemanticsLabel,
                        ),
                        const SizedBox(height: kSpace3),

                        // Skip button
                        SizedBox(
                          height: kMinTapTarget,
                          child: TextButton(
                            onPressed: _isLoading
                                ? null
                                : () => Navigator.of(context).pop(),
                            child: Text(
                              // Baho allaqachon ketgan bo'lsa "o'tkazib
                              // yuborish" yolg'on bo'lardi — endi bu faqat
                              // chaqimsiz yopish.
                              _ratingSubmitted
                                  ? 'Chaqimsiz yopish'
                                  : "O'tkazib yuborish",
                              style: const TextStyle(
                                color: kInkMuted,
                                fontSize: kFontTitle,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  String get _primaryLabel =>
      _ratingSubmitted && _tipLocked ? 'Yopish' : 'Yuborish';

  String get _primarySemanticsLabel {
    final amount = _tipAmount;
    if (amount == null) return '$_primaryLabel, chaqimsiz';
    return '$_primaryLabel, ${Formatters.formatSom(amount.toDouble())} chaqim bilan';
  }

  // ---------------------------------------------------------------------
  // Chaqim bloki
  // ---------------------------------------------------------------------

  Widget _buildTipSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace4),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: kLine),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              ExcludeSemantics(
                child: Icon(
                  Icons.volunteer_activism_rounded,
                  size: 20,
                  color: kMintDeep,
                ),
              ),
              SizedBox(width: kSpace2),
              Expanded(
                child: Text(
                  'Haydovchiga chaqim',
                  style: TextStyle(
                    fontSize: kFontTitle,
                    fontWeight: FontWeight.w800,
                    color: kInk,
                  ),
                ),
              ),
              // Ixtiyoriyligi darhol ko'rinsin — aks holda majburiy qadam
              // deb o'qiladi va foydalanuvchi ekranda qotib qoladi.
              Text(
                'Ixtiyoriy',
                style: TextStyle(
                  fontSize: kFontCaption,
                  fontWeight: FontWeight.w600,
                  color: kInkMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace1),
          const Text(
            "Summa to'liq haydovchiga o'tadi — komissiya ushlanmaydi. "
            "Hamyoningizdan yechiladi.",
            style: TextStyle(
              fontSize: kFontCaption,
              color: kInkMuted,
              height: 1.35,
            ),
          ),
          const SizedBox(height: kSpace3),
          if (_tipLocked)
            _buildTipNotice()
          else ...[
            Wrap(
              spacing: kSpace2,
              runSpacing: kSpace2,
              children: [
                for (final amount in _tipPresets)
                  _TipChip(
                    label: Formatters.formatSom(amount.toDouble()),
                    selected: !_customTipOpen && _selectedTip == amount,
                    enabled: !_isLoading,
                    onTap: () => _selectPreset(amount),
                  ),
                _TipChip(
                  label: 'Boshqa',
                  selected: _customTipOpen,
                  enabled: !_isLoading,
                  onTap: _toggleCustom,
                ),
              ],
            ),
            if (_customTipOpen) ...[
              const SizedBox(height: kSpace3),
              TextField(
                controller: _customTipController,
                autofocus: true,
                enabled: !_isLoading,
                keyboardType: TextInputType.number,
                inputFormatters: [
                  FilteringTextInputFormatter.digitsOnly,
                  LengthLimitingTextInputFormatter(6),
                ],
                onChanged: (_) {
                  if (_tipFieldError != null || _tipSubmitError != null) {
                    setState(() {
                      _tipFieldError = null;
                      _tipSubmitError = null;
                    });
                  }
                },
                style: const TextStyle(
                  fontSize: kFontH3,
                  fontWeight: FontWeight.w700,
                  color: kInk,
                ),
                decoration: InputDecoration(
                  filled: true,
                  fillColor: kSurface2,
                  hintText:
                      '${Formatters.formatAmount(_tipMin.toDouble())} – '
                      '${Formatters.formatAmount(_tipMax.toDouble())}',
                  hintStyle: const TextStyle(
                    color: kInkMuted,
                    fontWeight: FontWeight.w400,
                  ),
                  suffixText: "so'm",
                  suffixStyle: const TextStyle(
                    color: kInkMuted,
                    fontWeight: FontWeight.w600,
                  ),
                  errorText: _tipFieldError,
                  errorStyle: const TextStyle(color: kErrorDeep),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(kRadiusSm),
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(kRadiusSm),
                    borderSide: const BorderSide(color: kPrimary, width: 2),
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: kSpace4,
                    vertical: kSpace3,
                  ),
                ),
              ),
            ],
          ],
          // `_tipLocked` holatida xabar yuqoridagi izohda allaqachon
          // aytilgan — bir xil matnni ikki marta ko'rsatish shovqin.
          if (_tipSubmitError != null && !_tipLocked) ...[
            const SizedBox(height: kSpace3),
            _TipError(message: _tipSubmitError!),
          ],
        ],
      ),
    );
  }

  /// 409'dan keyingi holat: tanlov o'rnini yakuniy tushuntirish egallaydi.
  Widget _buildTipNotice() {
    return const Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ExcludeSemantics(
          child: Icon(Icons.check_circle_rounded, size: 18, color: kMintDeep),
        ),
        SizedBox(width: kSpace2),
        Expanded(
          child: Text(
            'Bu safar uchun chaqim allaqachon berilgan.',
            style: TextStyle(fontSize: kFontLabel, color: kInkMuted),
          ),
        ),
      ],
    );
  }

  String _ratingLabel(int score) {
    switch (score) {
      case 1:
        return 'Juda yomon';
      case 2:
        return 'Yomon';
      case 3:
        return 'Oddiy';
      case 4:
        return 'Yaxshi';
      case 5:
        return 'Ajoyib!';
      default:
        return 'Yulduz tanlang';
    }
  }
}

/// Chaqim summasi chipi.
///
/// ⚠️ Tanlangan holat FAQAT rang bilan ko'rsatilmaydi: to'ldirish + qalin
/// chegara + belgi (✓) birga ishlaydi, shunda rangni ajrata olmaydigan
/// foydalanuvchi ham qaysi summa tanlanganini ko'radi.
class _TipChip extends StatelessWidget {
  const _TipChip({
    required this.label,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final Color background;
    final Color border;
    final Color foreground;
    if (!enabled) {
      background = kSurface2;
      border = kLine;
      foreground = kInkSubtle;
    } else if (selected) {
      // kPrimary ustida oq yozuv — 5.38:1 (AA).
      background = kPrimary;
      border = kPrimary;
      foreground = kOnPrimary;
    } else {
      background = kSurface;
      border = kLineStrong;
      foreground = kInk;
    }

    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: AppPressable(
        onTap: enabled ? onTap : null,
        haptic: AppHapticLevel.select,
        pressedScale: 0.94,
        minTapTarget: false,
        child: Container(
          constraints: const BoxConstraints(minHeight: kMinTapTarget),
          padding: const EdgeInsets.symmetric(horizontal: kSpace4),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(kRadiusSm),
            border: Border.all(
              color: border,
              width: selected ? 2 : 1.5,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (selected) ...[
                Icon(Icons.check_rounded, size: 16, color: foreground),
                const SizedBox(width: kSpace1),
              ],
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: kFontBody,
                  fontWeight: FontWeight.w700,
                  color: foreground,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Chaqim xatosi — snackbar emas, blok ichida: xabar summa tanlash joyining
/// yonida turishi kerak, chunki keyingi qadam aynan shu yerda (kichikroq
/// summa tanlash yoki hamyonni to'ldirish).
class _TipError extends StatelessWidget {
  const _TipError({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: kErrorLight,
        borderRadius: BorderRadius.circular(kRadiusSm),
        border: Border.all(color: kErrorBorder),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const ExcludeSemantics(
            child: Icon(
              Icons.error_outline_rounded,
              size: 18,
              color: kErrorDeep,
            ),
          ),
          const SizedBox(width: kSpace2),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                fontSize: kFontLabel,
                color: kErrorDeep,
                height: 1.35,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
