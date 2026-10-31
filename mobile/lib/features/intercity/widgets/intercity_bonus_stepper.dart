import 'package:angren_taxi/features/superapp/widgets/ag_design.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';
import 'package:flutter/material.dart';

/// "Narxni oshirish": − [qo'shimcha] + — [step] qadam bilan [min]..[max].
///
/// Yo'lovchi tarifdan ARZON taklif qila olmaydi (qaror: qat'iy tarif +
/// faqat oshirish), shuning uchun pastki chegara 0 yoki joriy qo'shimcha.
class IntercityBonusStepper extends StatelessWidget {
  const IntercityBonusStepper({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.onChanged,
  });

  final int value;
  final int min;
  final int max;
  final int step;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                l10n.icReqBonusTitle,
                style: const TextStyle(fontSize: kFontBody, fontWeight: FontWeight.w700, color: agText),
              ),
              const SizedBox(height: 2),
              Text(
                l10n.icReqBonusHint,
                style: const TextStyle(fontSize: kFontCaption, color: agSubtle),
              ),
            ],
          ),
        ),
        IconButton(
          key: const ValueKey('ic_bonus_minus'),
          tooltip: l10n.icReqBonusDecrease,
          onPressed: value - step >= min ? () => onChanged(value - step) : null,
          icon: const Icon(Icons.remove_circle_outline_rounded),
        ),
        ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 72),
          child: Text(
            value == 0 ? '0' : '+${Formatters.formatPrice(value.toDouble())}',
            key: const ValueKey('ic_bonus_value'),
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: kFontBody,
              fontWeight: FontWeight.w800,
              color: value > 0 ? agGreenText : agSubtle,
            ),
          ),
        ),
        IconButton(
          key: const ValueKey('ic_bonus_plus'),
          tooltip: l10n.icReqBonusIncrease,
          onPressed: value + step <= max ? () => onChanged(value + step) : null,
          icon: const Icon(Icons.add_circle_outline_rounded),
        ),
      ],
    );
  }
}
