import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:flutter/material.dart';

/// Olish/tushirish qatori: belgi, sarlavha, manzil va izoh (zona/davom).
/// [onTap] berilsa bosiladi (xaritadan tanlash); [error] — izoh qizil.
class IntercityPlaceCard extends StatelessWidget {
  const IntercityPlaceCard({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.hint,
    this.error = false,
    this.onTap,
  });

  final IconData icon;
  final String label;
  final String value;
  final String hint;
  final bool error;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: agSurface,
      borderRadius: BorderRadius.circular(agRadiusMd),
      child: InkWell(
        borderRadius: BorderRadius.circular(agRadiusMd),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(kSpace4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: agGreenText),
              const SizedBox(width: kSpace3),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: const TextStyle(
                        fontSize: kFontCaption,
                        fontWeight: FontWeight.w700,
                        color: agSubtle,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      value,
                      style: const TextStyle(
                        fontSize: kFontBody,
                        fontWeight: FontWeight.w700,
                        color: agText,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      hint,
                      style: TextStyle(
                        fontSize: kFontCaption,
                        color: error ? agRed : agSubtle,
                      ),
                    ),
                  ],
                ),
              ),
              if (onTap != null)
                const Icon(Icons.chevron_right_rounded, color: agMuted),
            ],
          ),
        ),
      ),
    );
  }
}
