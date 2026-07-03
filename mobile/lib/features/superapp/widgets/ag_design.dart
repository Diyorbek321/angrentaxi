import 'package:flutter/material.dart';

// ============================================================================
// Angren Go — design tokens lifted 1:1 from the interactive prototype.
// ============================================================================

const Color agGreen = Color(0xFF10A064); // primary deep green
const Color agMint = Color(0xFF1FCA8E); // gradient start
const Color agBright = Color(0xFF27D89B); // bright accent / gradient top
const Color agInk = Color(0xFF0F1B22); // near-black text & dark cards
const Color agBg = Color(0xFFF4F7F8); // app background
const Color agSurface = Color(0xFFFFFFFF);
const Color agText = Color(0xFF0F1B22);
const Color agSubtle = Color(0xFF6B7785); // secondary text
const Color agMuted = Color(0xFF9AA6B0); // tertiary / placeholders
const Color agDivider = Color(0xFFF1F4F6);
const Color agBorder = Color(0xFFE4E9ED);
const Color agTint = Color(0xFFE6FAF2); // green tint surface
const Color agRed = Color(0xFFE5484D);
const Color agOrange = Color(0xFFF59E0B);
const Color agBlue = Color(0xFF3B82F6);
const Color agPurple = Color(0xFF8B5CF6);

/// The signature green gradient used on every primary CTA.
const LinearGradient agCta = LinearGradient(
  colors: [agMint, agGreen],
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
);

/// Header radial-style green gradient (approximated with a linear gradient).
const LinearGradient agHeader = LinearGradient(
  colors: [agBright, agGreen],
  begin: Alignment.topRight,
  end: Alignment.bottomLeft,
);

List<BoxShadow> agCardShadow = [
  BoxShadow(
    color: agInk.withValues(alpha: 0.05),
    blurRadius: 20,
    offset: const Offset(0, 8),
  ),
];

List<BoxShadow> agSoftShadow = [
  BoxShadow(
    color: agInk.withValues(alpha: 0.07),
    blurRadius: 24,
    offset: const Offset(0, 10),
  ),
];

List<BoxShadow> agCtaShadow = [
  BoxShadow(
    color: agGreen.withValues(alpha: 0.32),
    blurRadius: 28,
    offset: const Offset(0, 14),
  ),
];

/// Full-width green gradient CTA button (the prototype's primary action).
class AgPrimaryButton extends StatelessWidget {
  const AgPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.height = 56,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final double height;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onPressed,
      child: Container(
        height: height,
        decoration: BoxDecoration(
          gradient: agCta,
          borderRadius: BorderRadius.circular(16),
          boxShadow: agCtaShadow,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.w800,
              ),
            ),
            if (icon != null) ...[
              const SizedBox(width: 8),
              Icon(icon, color: Colors.white, size: 20),
            ],
          ],
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
        16,
        MediaQuery.of(context).padding.top + 12,
        16,
        14,
      ),
      decoration: BoxDecoration(
        color: agSurface,
        boxShadow: [
          BoxShadow(
            color: agInk.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Row(
        children: [
          if (onBack != null)
            AgIconButton(
              icon: Icons.arrow_back_rounded,
              onTap: onBack!,
            ),
          if (onBack != null) const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                    color: agText,
                  ),
                ),
                if (subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    subtitle!,
                    style: const TextStyle(
                      fontSize: 12,
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

/// Rounded square icon button on a light-grey surface (back / action chips).
class AgIconButton extends StatelessWidget {
  const AgIconButton({
    super.key,
    required this.icon,
    required this.onTap,
    this.background = agBg,
    this.color = agText,
    this.size = 42,
    this.badge,
  });

  final IconData icon;
  final VoidCallback onTap;
  final Color background;
  final Color color;
  final double size;
  final String? badge;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              color: background,
              borderRadius: BorderRadius.circular(13),
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
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(color: Colors.white, width: 2),
                ),
                child: Text(
                  badge!,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
        ],
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
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 56,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        decoration: BoxDecoration(
          color: agInk,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: agInk.withValues(alpha: 0.28),
              blurRadius: 34,
              offset: const Offset(0, 16),
            ),
          ],
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
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$count',
                style: const TextStyle(
                  color: Color(0xFF06231A),
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(width: 9),
            Text(
              label,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14.5,
                fontWeight: FontWeight.w800,
              ),
            ),
            const Spacer(),
            Text(
              trailing,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
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
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: agText,
          ),
        ),
        const Spacer(),
        if (trailing != null)
          GestureDetector(
            onTap: onTrailingTap,
            child: Text(
              trailing!,
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: agGreen,
              ),
            ),
          ),
      ],
    );
  }
}
