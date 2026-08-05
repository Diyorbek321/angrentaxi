import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';

/// Superapp ekranlari `ag*` va `k*` tokenlarni aralash ishlatadi
/// (masalan `agSurface` + `kRadiusMd`). Ikkita import saqlash o'rniga
/// kanonik manba shu yerdan re-export qilinadi — qiymatlar baribir bitta
/// joyda (`app_theme.dart`) e'lon qilinadi.
export 'package:angren_taxi/core/config/app_theme.dart';

// ============================================================================
// Angren Go — superapp token aliases.
//
// ⚠️ BU FAYL O'Z QIYMATLARINI E'LON QILMAYDI.
// Har bir `ag*` token `core/config/app_theme.dart` dagi kanonik `k*` tokenning
// aliasi. Yangi rang/radius/soya kerak bo'lsa — avval app_theme.dart ga
// qo'shing, keyin shu yerda alias yarating.
//
// Kanonik ta'rif: docs/DESIGN-TOKENS.md
// ============================================================================

// --- Brand: INTERAKTIV qatlam (to'q yashil) ---
/// Interaktiv to'ldirish (tugma, faol holat). Oq matn bilan 5.38:1.
const Color agPrimary = kPrimary; // #0C7A4D
const Color agPrimaryHover = kPrimaryHover; // #0A6741
const Color agPrimaryPressed = kPrimaryPressed; // #084F32

/// Interaktiv to'ldirish ustidagi matn — OQ.
const Color agOnPrimary = kOnPrimary; // #FFFFFF

/// Yorug' fonda ma'noli yashil MATN / ikona (5.38:1).
const Color agGreenText = kPrimary; // #0C7A4D

// --- Brand: AKSENT qatlam (mint) ---
/// ⚠️ Mint yorug' yuzada MA'NO tashimaydi (oq ustida 2.12:1).
/// Faqat: ink matn ortidagi to'ldirish, dekorativ element, qorong'i yuza.
const Color agMint = kMint; // #1FCA8E
const Color agBright = kMintBright; // #27D89B
const Color agGreen = kMintDeep; // #10A064 — aksent gradient oxiri
const Color agTint = kMintTint; // #E6FAF2 — chip/badge foni

/// Mint TO'LDIRISH ustidagi matn (7.84:1). Mint ustida oq ishlatmang.
const Color agOnMint = kOnMint; // #06231A

// --- Neutrals ---
const Color agInk = kInk; // #0F1B22
const Color agBg = kBackground; // #F4F7F8
const Color agSurface = kSurface; // #FFFFFF
const Color agSurface2 = kSurface2; // #EDF3F4
const Color agText = kInk; // #0F1B22
const Color agSubtle = kInkMuted; // #5A6C75 (AA 5.47:1)
const Color agMuted = kInkSubtle; // #78888F (large/UI 3.67:1)
const Color agDivider = kDivider; // #F1F4F6
const Color agBorder = kLine; // #E4E9ED

// --- Status ---
const Color agRed = kError; // #E5484D
const Color agOrange = kWarning; // #F59E0B
const Color agBlue = kInfo; // #3B82F6
const Color agPurple = kAccentViolet; // #8B5CF6

// --- Radii (superapp shorthand) ---
const double agRadiusSm = kRadiusSm; // 12
const double agRadiusMd = kRadiusMd; // 16
const double agRadiusLg = kRadiusLg; // 22

/// Interaktiv CTA gradienti — OQ matn bilan (eng och nuqta 5.38:1).
const LinearGradient agCta = kGradientCta;

/// Dekorativ mint gradient — CTA EMAS, ustiga faqat `agInk` matn.
const LinearGradient agMintGradient = kGradientMint;

/// Ekran header gradienti. Endi INTERAKTIV (to'q yashil) gradient.
///
/// ⚠️ Ilgari bu mint gradient edi (`#27D89B → #10A064`) va ustida oq matn
/// turardi — eng och nuqtada atigi **1.85:1**, ya'ni jiddiy qoidabuzarlik.
/// Header — dekorativ yuza bo'lgani uchun ikki yo'l bor edi: (a) mintni
/// saqlab, butun header matnini `agInk` ga o'tkazish, (b) gradientni
/// to'qlashtirib, oq matnni saqlash. Egasining qarori "fon to'qlashadi,
/// matn oq qoladi" bo'lgani uchun (b) tanlandi — eng och nuqtada 5.38:1.
const LinearGradient agHeader = kGradientCta;

/// Dark "ink" hero card gradient (wallet, promo, referral banners).
const LinearGradient agInkGradient = kGradientInk;

final List<BoxShadow> agCardShadow = kShadowCard;

final List<BoxShadow> agSoftShadow = kShadowPop;

final List<BoxShadow> agCtaShadow = kShadowCta;

final List<BoxShadow> agInkShadow = kShadowInk;

/// To'liq kenglikdagi asosiy CTA tugmasi (superapp ekranlari).
///
/// `shared/widgets/app_button.dart` dagi `AppButton` bilan bir xil
/// balandlik (`kControlHeight`), radius (`kRadiusMd`) va yozuv o'lchamiga
/// (`kFontTitle`) ega — farqi faqat gradientli to'ldirish va glow soyasi.
///
/// Holatlar: normal `kGradientCta` · pressed `kPrimaryPressed` (9.66:1) ·
/// disabled `kPrimaryDisabled` fon + `kInkMuted` yozuv (4.88:1).
class AgPrimaryButton extends StatefulWidget {
  const AgPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.height = kControlHeight,
    this.isLoading = false,
    this.semanticsLabel,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;
  final bool isLoading;
  final String? semanticsLabel;

  @override
  State<AgPrimaryButton> createState() => _AgPrimaryButtonState();
}

class _AgPrimaryButtonState extends State<AgPrimaryButton> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null && !widget.isLoading;
    final fg = enabled ? agOnPrimary : kInkMuted;

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.semanticsLabel ?? widget.label,
      value: widget.isLoading ? 'Yuklanmoqda' : null,
      excludeSemantics: true,
      child: GestureDetector(
        onTap: enabled ? widget.onPressed : null,
        onTapDown: enabled ? (_) => setState(() => _pressed = true) : null,
        onTapUp: enabled ? (_) => setState(() => _pressed = false) : null,
        onTapCancel: enabled ? () => setState(() => _pressed = false) : null,
        child: AnimatedContainer(
          duration: kDurationFast,
          curve: kEaseStandard,
          height: widget.height < kMinTapTarget
              ? kMinTapTarget
              : widget.height,
          decoration: BoxDecoration(
            color: enabled
                ? (_pressed ? kPrimaryPressed : null)
                : kPrimaryDisabled,
            gradient: enabled && !_pressed ? agCta : null,
            borderRadius: BorderRadius.circular(kRadiusMd),
            boxShadow: enabled && !_pressed ? agCtaShadow : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: widget.isLoading
                ? [
                    SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        valueColor: AlwaysStoppedAnimation<Color>(fg),
                      ),
                    ),
                  ]
                : [
                    Text(
                      widget.label,
                      style: TextStyle(
                        color: fg,
                        fontSize: kFontTitle,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (widget.icon != null) ...[
                      const SizedBox(width: kSpace2),
                      Icon(widget.icon, color: fg, size: 20),
                    ],
                  ],
          ),
        ),
      ),
    );
  }
}

/// White sticky-style header with a rounded back button and title, used across
/// nearly every secondary screen in the prototype.
class AgHeader extends StatelessWidget {
  const AgHeader({
    super.key,
    required this.title,
    this.subtitle,
    this.onBack,
    this.trailing,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        kSpace4,
        MediaQuery.of(context).padding.top + kSpace3,
        kSpace4,
        kSpace3,
      ),
      decoration: BoxDecoration(
        color: agSurface,
        boxShadow: agCardShadow,
      ),
      child: Row(
        children: [
          if (onBack != null)
            AgIconButton(
              icon: Icons.arrow_back_rounded,
              onTap: onBack!,
              semanticsLabel: 'Orqaga',
            ),
          if (onBack != null) const SizedBox(width: kSpace3),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: kFontH2,
                    fontWeight: FontWeight.w800,
                    color: agText,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: kFontCaption,
                      fontWeight: FontWeight.w600,
                      color: agSubtle,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Yumaloq kvadrat ikona tugmasi (orqaga, savat, bildirishnoma).
///
/// Vizual o'lchami 42dp bo'lsa ham, tegish maydoni har doim kamida
/// `kMinTapTarget` (48dp) — `SizedBox` orqali kengaytiriladi.
/// Ikonka yolg'iz o'zi ma'no tashiganligi uchun `semanticsLabel` MAJBURIY.
class AgIconButton extends StatelessWidget {
  const AgIconButton({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticsLabel,
    this.background = agBg,
    this.color = agText,
    this.size = 42,
    this.badge,
  });

  final IconData icon;
  final VoidCallback onTap;

  /// Ekran o'quvchi uchun tugmaning nomi ("Orqaga", "Savat", ...).
  final String semanticsLabel;

  final Color background;
  final Color color;
  final double size;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    final tap = size < kMinTapTarget ? kMinTapTarget : size;

    return Semantics(
      button: true,
      label: semanticsLabel,
      value: badge,
      excludeSemantics: true,
      child: SizedBox(
        width: tap,
        height: tap,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(kRadiusSm),
            child: Center(
              child: Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: size,
                    height: size,
                    decoration: BoxDecoration(
                      color: background,
                      borderRadius: BorderRadius.circular(kRadiusSm),
                    ),
                    child: Icon(icon, color: color, size: 22),
                  ),
                  if (badge != null)
                    Positioned(
                      top: -3,
                      right: -3,
                      child: Container(
                        constraints: const BoxConstraints(minWidth: 18),
                        height: 18,
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: agRed,
                          borderRadius: BorderRadius.circular(kRadiusFull),
                          border: Border.all(color: agSurface, width: 2),
                        ),
                        child: Text(
                          badge!,
                          style: const TextStyle(
                            color: agOnPrimary,
                            fontSize: kFontMicro,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Sticky cart bar that floats above content (dark pill with count + total).
class AgCartBar extends StatelessWidget {
  const AgCartBar({
    super.key,
    required this.count,
    required this.label,
    required this.trailing,
    required this.onTap,
  });

  final int count;
  final String label;
  final String trailing;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Savat: $count ta mahsulot, $trailing. $label',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: kControlHeight,
          padding: const EdgeInsets.symmetric(horizontal: kSpace5),
          decoration: BoxDecoration(
            color: agInk,
            borderRadius: BorderRadius.circular(kRadiusMd),
            boxShadow: agInkShadow,
          ),
          child: Row(
            children: [
              Container(
                constraints: const BoxConstraints(minWidth: 24),
                height: 24,
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 5),
                decoration: BoxDecoration(
                  color: agBright,
                  borderRadius: BorderRadius.circular(kRadiusXs),
                ),
                child: Text(
                  '$count',
                  style: const TextStyle(
                    color: agOnMint,
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(width: kSpace2),
              Text(
                label,
                style: const TextStyle(
                  color: agOnPrimary,
                  fontSize: kFontBody,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const Spacer(),
              Text(
                trailing,
                style: const TextStyle(
                  color: agOnPrimary,
                  fontSize: kFontTitle,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Small section title used between content blocks.
class AgSectionTitle extends StatelessWidget {
  const AgSectionTitle(this.text, {super.key, this.trailing, this.onTrailingTap});
  final String text;
  final String? trailing;
  final VoidCallback? onTrailingTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(
          text,
          style: const TextStyle(
            fontSize: kFontH3,
            fontWeight: FontWeight.w800,
            color: agText,
          ),
        ),
        const Spacer(),
        if (trailing != null)
          Semantics(
            button: onTrailingTap != null,
            label: trailing,
            excludeSemantics: true,
            child: GestureDetector(
              onTap: onTrailingTap,
              behavior: HitTestBehavior.opaque,
              // Yozuv kichik bo'lsa ham tegish maydoni 48dp dan kam emas.
              child: Container(
                constraints: const BoxConstraints(minHeight: kMinTapTarget),
                alignment: Alignment.centerRight,
                padding: const EdgeInsets.only(left: kSpace3),
                child: Text(
                  trailing!,
                  style: const TextStyle(
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w700,
                    color: agGreenText,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
