import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/shared/widgets/app_status_badge.dart';
import 'package:flutter/material.dart';

/// Bosh ekrandagi tekshiruv xabari — bloklangan yoki muddat yaqinlashgan.
///
/// Ma'no faqat RANGDA emas: ikonka + sarlavha + matn + harakat tugmasi
/// birga keladi (WCAG 1.4.1). Bloklangan holatda bu ekrandagi YAGONA
/// javob beriladigan savol, shuning uchun u hero kartadan ham yuqorida
/// turadi.
class DriverVerificationNotice extends StatelessWidget {
  const DriverVerificationNotice({
    super.key,
    required this.tone,
    required this.icon,
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onAction,
  });

  final AppStatusTone tone;
  final IconData icon;
  final String title;
  final String message;
  final String actionLabel;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final fg = tone.foreground;
    return Container(
      padding: const EdgeInsets.all(kSpace3),
      decoration: BoxDecoration(
        color: tone.background,
        borderRadius: BorderRadius.circular(kRadiusMd),
        border: Border.all(color: fg.withValues(alpha: 0.24)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ExcludeSemantics(child: Icon(icon, color: fg, size: 20)),
              const SizedBox(width: kSpace2),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: TextStyle(
                        color: fg,
                        fontSize: kFontLabel,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      message,
                      style: const TextStyle(
                        color: kInk,
                        fontSize: kFontCaption,
                        height: 1.35,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: kSpace1),
          Align(
            alignment: Alignment.centerLeft,
            child: ConstrainedBox(
              // ⚠️ `kMinTapTarget` (48) EMAS. Bu haydovchi ilovasi:
              // ikkilamchi nishon ham kamida `kMinTapTargetDriver` (56)
              // bo'lishi kerak, chunki barmoq tebranayotgan mashinada
              // nishonga tegadi.
              constraints: const BoxConstraints(
                minHeight: kMinTapTargetDriver,
              ),
              child: TextButton(
                onPressed: onAction,
                style: TextButton.styleFrom(foregroundColor: fg),
                child: Text(
                  actionLabel,
                  style: const TextStyle(
                    fontSize: kFontLabel,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
