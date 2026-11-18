import 'package:angren_taxi/core/config/app_theme.dart';
import 'package:angren_taxi/l10n/l10n.dart';
import 'package:flutter/material.dart';

/// "Haydovchi topilmadi" — qidiruvning BO'SH natijasi.
///
/// ⚠️ NEGA SNACKBAR EMAS. Ilgari 4 soniyalik qizil yozuv chiqib yo'qolardi
/// va yo'lovchi butun buyurtmani (manzil, tarif, opsiyalar) qaytadan
/// qurishi kerak edi. Siyrak Angrenda bu tez-tez bo'ladigan holat, ya'ni
/// boshi berk ko'cha emas, aniq ikki yo'l bo'lishi shart:
///   · "Qayta izlash" — o'sha buyurtma bir bosishda (haydovchi shu orada
///     bo'shagan bo'lishi mumkin);
///   · "Boshqa tarif" — marshrut saqlangan holda tarif ekrani.
/// Rang XATO emas: bu yo'lovchining aybi ham, ilovaning buzilishi ham emas.
enum NoDriversChoice { retry, otherTariff, close }

Future<NoDriversChoice> showNoDriversSheet(
  BuildContext context, {
  required bool canRetry,
}) async {
  final choice = await showModalBottomSheet<NoDriversChoice>(
    context: context,
    showDragHandle: true,
    // Katta shrift / kichik ekranda standart 9/16 balandlikka sig'maydi —
    // kontent balandligicha o'sadi va kerak bo'lsa aylantiriladi.
    isScrollControlled: true,
    builder: (context) => _NoDriversSheet(canRetry: canRetry),
  );
  return choice ?? NoDriversChoice.close;
}

class _NoDriversSheet extends StatelessWidget {
  const _NoDriversSheet({required this.canRetry});

  final bool canRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = context.l10n;
    return SafeArea(
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(kSpace4, 0, kSpace4, kSpace4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const ExcludeSemantics(
                child: Icon(Icons.search_off_rounded,
                    size: 40, color: kWarningDeep),
              ),
              const SizedBox(height: kSpace3),
              Text(
                l10n.paxNoDriversTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: kFontH3,
                  fontWeight: FontWeight.w700,
                  color: kInk,
                ),
              ),
              const SizedBox(height: kSpace2),
              Text(
                l10n.paxNoDriversBody,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: kFontBody, color: kInkMuted),
              ),
              const SizedBox(height: kSpace5),
              if (canRetry) ...[
                ElevatedButton.icon(
                  key: const ValueKey('no-drivers-retry'),
                  onPressed: () =>
                      Navigator.of(context).pop(NoDriversChoice.retry),
                  icon: const Icon(Icons.refresh_rounded),
                  label: Text(l10n.paxNoDriversRetry),
                ),
                const SizedBox(height: kSpace2),
              ],
              OutlinedButton(
                key: const ValueKey('no-drivers-other-tariff'),
                onPressed: () =>
                    Navigator.of(context).pop(NoDriversChoice.otherTariff),
                child: Text(l10n.paxNoDriversOtherTariff),
              ),
              TextButton(
                onPressed: () =>
                    Navigator.of(context).pop(NoDriversChoice.close),
                child: Text(l10n.paxNoDriversClose),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
