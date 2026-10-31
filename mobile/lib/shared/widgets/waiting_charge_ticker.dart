import 'dart:async';

import 'package:angren_taxi/shared/utils/waiting_charge.dart';
import 'package:flutter/material.dart';

// ============================================================================
// KUTISH HISOBLAGICHI — TIKLANADIGAN SANOQ.
//
// ⚠️ TIMER FAQAT CHIZADI, SANAMAYDI. Ilgari haydovchi ekranidagi hisoblagich
// `Timer.periodic` ichida `_waitingSeconds++` qilardi, ya'ni vaqt EKRAN
// OCHILGANDA noldan boshlanardi: ilova qayta ishga tushsa yoki ekran qayta
// qurilsa raqam nolga qaytardi va haydovchi 8 daqiqa kutgan bo'lsa ham
// "0 soniya" ko'rsatardi. Endi manba — serverdagi `arrivedAt`; timer atigi
// sekundiga bir marta `setState` chaqirib qayta chizadi. Ilova qayta ishga
// tushsa ham raqam TO'G'RI qoladi, chunki u hech qayerda saqlanmaydi —
// har kadrda `now - arrivedAt` dan qayta hisoblanadi.
//
// ⚠️ IKKALA ILOVA SHU VIDJETNI ISHLATADI. Haydovchi va yo'lovchi bir xil
// sonni ko'rishi shart, shuning uchun hisob ham, tiklash ham bitta joyda;
// ekranlar faqat KO'RINISHNI (`builder`) beradi.
// ============================================================================

/// Har soniyada [WaitingCharge] ni qayta hisoblab, [builder] ni chaqiradi.
///
/// `arrivedAt` `null` bo'lsa — haydovchi hali "keldim" bosmagan yoki
/// buyurtma migratsiyadan oldin yaratilgan — hech narsa chizilmaydi.
/// Hisoblagichni ko'rsatib, unda nol turishi "kutish boshlandi" degan
/// yolg'on ma'no berardi.
///
/// Hisoblagichni TO'XTATISH uchun vidjetni daraxtdan olib tashlash kifoya:
/// safar boshlangach (`in_progress`) ekranlar uni ko'rsatmaydi, chunki
/// undan keyingi vaqt server tomonda `timeFare` ga o'tadi va ikki marta
/// undirilmasligi kerak.
class WaitingChargeTicker extends StatefulWidget {
  const WaitingChargeTicker({
    super.key,
    required this.arrivedAt,
    required this.builder,
    this.freeWaitMinutes = kDefaultFreeWaitMinutes,
    this.waitingPricePerMinute = kDefaultWaitingPricePerMinute,
    this.clock,
  });

  /// Haydovchi "yetib keldim" bosgan lahza — SERVER vaqti.
  final DateTime? arrivedAt;

  /// Tarifdan kelgan bepul oyna. Buyurtma javobida `freeWaitMinutes`.
  final int freeWaitMinutes;

  /// Tarifdan kelgan daqiqa narxi. Buyurtma javobida
  /// `waitingPricePerMinute`.
  final int waitingPricePerMinute;

  /// Hisoblangan holatni ko'rinishga aylantiradi.
  final Widget Function(BuildContext context, WaitingCharge charge) builder;

  /// Testlar uchun soatni qotirish nuqtasi. `null` — `DateTime.now`.
  final DateTime Function()? clock;

  @override
  State<WaitingChargeTicker> createState() => _WaitingChargeTickerState();
}

class _WaitingChargeTickerState extends State<WaitingChargeTicker> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _syncTicker();
  }

  @override
  void didUpdateWidget(covariant WaitingChargeTicker oldWidget) {
    super.didUpdateWidget(oldWidget);
    // `arrivedAt` null'dan qiymatga o'tishi mumkin: yo'lovchi ilovasida bu
    // `order:arrived` soketi kelgan lahza. Timer o'shanda yo'lga tushadi.
    if (oldWidget.arrivedAt != widget.arrivedAt) _syncTicker();
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  void _syncTicker() {
    _ticker?.cancel();
    _ticker = null;
    // `arrivedAt` yo'q — chiziladigan narsa ham yo'q, sekundlik `setState`
    // ham keraksiz.
    if (widget.arrivedAt == null) return;
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  Widget build(BuildContext context) {
    final arrivedAt = widget.arrivedAt;
    if (arrivedAt == null) return const SizedBox.shrink();

    final charge = computeWaitingCharge(
      arrivedAt: arrivedAt,
      now: (widget.clock ?? DateTime.now)(),
      freeWaitMinutes: widget.freeWaitMinutes,
      waitingPricePerMinute: widget.waitingPricePerMinute,
    );

    return widget.builder(context, charge);
  }
}
