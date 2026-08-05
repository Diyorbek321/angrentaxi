import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Premium animated loader — a pulsing branded badge with looping glow.
/// Used app-wide for every loading / "searching" state.
class LoadingWidget extends StatelessWidget {
  const LoadingWidget({super.key, this.message, this.icon = Icons.bolt_rounded});

  final String? message;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            alignment: Alignment.center,
            children: [
              // Pulsing outer ring
              Container(
                width: 84,
                height: 84,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: kMint.withValues(alpha: 0.12),
                ),
              )
                  .animate(onPlay: (c) => c.repeat())
                  .scaleXY(
                    begin: 0.7,
                    end: 1.15,
                    duration: 1100.ms,
                    curve: Curves.easeInOut,
                  )
                  .fadeOut(begin: 0.6, duration: 1100.ms),
              // Solid gradient badge
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: kGradientCta,
                  boxShadow: [
                    BoxShadow(
                      color: kPrimary.withValues(alpha: 0.32),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                // kGradientCta ustidagi ikona — har doim kOnPrimary (5.38:1).
                child: Icon(icon, color: kOnPrimary, size: 28),
              )
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .scaleXY(
                    begin: 1,
                    end: 1.08,
                    duration: 700.ms,
                    curve: Curves.easeInOut,
                  ),
            ],
          ),
          if (message != null) ...[
            const SizedBox(height: 20),
            Text(
              message!,
              style: const TextStyle(
                fontSize: 14,
                color: kTextSecondary,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .fadeIn(begin: 0.4, duration: 800.ms),
          ],
        ],
      ),
    );
  }
}

class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({
    super.key,
    required this.child,
    required this.isLoading,
    this.message,
  });

  final Widget child;
  final bool isLoading;
  final String? message;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        child,
        if (isLoading)
          Positioned.fill(
            child: Container(
              color: kInk.withValues(alpha: 0.45),
              child: LoadingWidget(message: message),
            ),
          ),
      ],
    );
  }
}
