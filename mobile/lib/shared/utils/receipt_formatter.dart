import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order_receipt.dart';
import 'package:angren_taxi/shared/utils/formatters.dart';

// ============================================================================
// CHEKNI MATNGA AYLANTIRISH.
//
// NEGA VIDJETLARDAN AJRATILGAN: bu yerdagi hamma narsa sof funksiya —
// `OrderReceipt` kiradi, satr chiqadi. Flutter'siz test qilinadi, va aynan
// shu qism xato qilsa chek raqamlari yolg'on ko'rsatadi.
// ============================================================================

// ---------------------------------------------------------------------------
// Narx qatorlari va nusxalash matni
// ---------------------------------------------------------------------------

/// Summani AVVAL yaxlitlab, keyin formatlaydi.
///
/// NEGA: `Formatters.formatSom` kasrni KESADI (`toInt`). Tarkib qatorlari
/// kasr bo'lishi mumkin (7.4 km × 2 500 = 18 500.0, lekin 7.35 km × 2 500 =
/// 18 375.0 kabi holatlar ham bor), va har bir qatorni pastga kesish ustunni
/// jamiga qo'shilmaydigan qilib qo'yadi. Yaxlitlash xatoni ikki tomonga
/// taqsimlaydi va chek "qo'shib tekshirsa to'g'ri chiqadi" bo'lib qoladi.
String formatSomRounded(double value) =>
    Formatters.formatSom(value.roundToDouble());

/// Narx tarkibi qatorlari — EKRAN va NUSXALANGAN MATN uchun BITTA manba.
///
/// NEGA BITTA JOYDA: qatorlar ikki marta yozilsa, biri o'zgarganda ikkinchisi
/// ortda qoladi va nusxalangan chek ekrandagidan farq qila boshlaydi. Hujjat
/// uchun bu eng yomon xato turi — u jimgina yuzaga keladi.
///
/// Tartib backend invariantini takrorlaydi:
///   asos + masofa + vaqt + eng kam haq + koeffitsient + yuqori chegara
///     + kutish = jami
///
/// ⚠️ YAXLITLASH QATOR BO'YICHA EMAS, YIG'INDI BO'YICHA. Har bir qator
/// ALOHIDA yaxlitlansa, yarim so'mlar bir tomonga to'planib qolishi mumkin
/// va ustun ko'rsatilgan jamidan 1–2 so'm chetga chiqadi (masalan masofa
/// 18 592.5 va vaqt 5 612.5 — ikkalasi ham yuqoriga yaxlitlanadi, jami esa
/// butun songa tushadi). Chek qatorlari qo'shilmasa, u chekning umuman
/// yo'qligidan yomonroq. Shuning uchun ko'rsatiladigan qiymat =
/// yax(shu qatorgacha bo'lgan jami) − yax(oldingi jami): har bir qator
/// haqiqiy qiymatidan ko'pi bilan 1 so'm farq qiladi, ustun esa HAR DOIM
/// ko'rsatilgan jamiga teng chiqadi.
List<({String label, String value})> fareLines(FareBreakdown fare) {
  // Nol qatorlar ko'rsatilmaydi: "Eng kam haq tuzatmasi — 0 so'm" hech
  // narsani tushuntirmaydi, faqat chekni uzaytiradi. Ular baribir ro'yxatda
  // qoladi, chunki jamlangan yaxlitlash TO'LIQ ketma-ketlikni talab qiladi.
  //
  // ⚠️ KUTISH QATORI BU QOIDADAN ISTISNO — pastga qarang.
  final parts = <({String label, double value, bool visible})>[
    (label: AppL10n.current.shFareBase, value: fare.baseFare, visible: true),
    (
      label: AppL10n.current.shFareDistance(
        fare.distanceKm.toStringAsFixed(1),
        formatSomRounded(fare.pricePerKm),
      ),
      value: fare.distanceFare,
      visible: true,
    ),
    (
      label: AppL10n.current.shFareTime(
        fare.durationMin.round(),
        formatSomRounded(fare.pricePerMin),
      ),
      value: fare.timeFare,
      visible: true,
    ),
    (
      label: AppL10n.current.shFareMinAdjustment,
      value: fare.minPriceAdjustment,
      visible: fare.minPriceAdjustment > 0,
    ),
    (
      label: AppL10n.current.shFareSurge(
        fare.surgeMultiplier.toStringAsFixed(1),
      ),
      value: fare.surgeFare,
      visible: fare.surgeFare > 0,
    ),
    // Yuqori chegara har doim manfiy — u summani KAMAYTIRADI.
    (
      label: AppL10n.current.shFareMaxCap,
      value: fare.maxPriceCap,
      visible: fare.maxPriceCap < 0,
    ),
    // ⚠️ KUTISH QATORI NOL BO'LSA HAM KO'RSATILADI — yuqoridagi "nol qator
    // chiqmaydi" qoidasidan ATAYLAB istisno.
    //
    // Sababi: kutish haqi QAT'IY NARX KAFOLATIDAN TASHQARIDA, ya'ni
    // yo'lovchi ko'rsatilgan narxdan ortiq to'lashi mumkin bo'lgan yagona
    // qator aynan shu. Qator umuman bo'lmasa, "mendan kutish uchun pul
    // olishdimi?" degan savolga chekda javob QOLMAYDI — javobsizlik esa
    // nizoga aylanadi. "0 daq — 0 so'm" o'sha savolni bir qarashda yopadi
    // va qo'shimcha haq YO'QLIGINI hujjat bilan tasdiqlaydi.
    (
      label: _waitingLabel(fare),
      value: fare.waitingFare,
      visible: true,
    ),
  ];

  final lines = <({String label, String value})>[];
  var exactRunning = 0.0;
  var shownRunning = 0.0;

  for (final part in parts) {
    exactRunning += part.value;
    final shownTotal = exactRunning.roundToDouble();
    final shownValue = shownTotal - shownRunning;
    shownRunning = shownTotal;

    if (!part.visible) continue;

    lines.add((
      label: part.label,
      value: shownValue < 0
          ? '−${Formatters.formatSom(-shownValue)}'
          : Formatters.formatSom(shownValue),
    ));
  }

  return lines;
}

/// Kutish qatorining yorlig'i.
///
/// Daqiqa narxi chekda ALOHIDA yuborilmaydi (tarkibda faqat daqiqa va summa
/// bor), shuning uchun u bo'linma bilan tiklanadi. Bo'linma butun so'mga
/// tushmasa — ko'rsatilmaydi: "833,33 so'm" chekni tushuntirish o'rniga
/// chalkashtiradi, daqiqa va summa esa baribir joyida qoladi.
String _waitingLabel(FareBreakdown fare) {
  final minutes = fare.waitingMinutes;
  if (minutes <= 0) {
    // Nol holatda ham SABAB yoziladi: "0 daq" yolg'iz o'zi haydovchi umuman
    // kutmaganini bildirardi, aslida esa u bepul oynadan oshmagan.
    return AppL10n.current.shFareWaitingFree;
  }

  final perMinute = fare.waitingFare / minutes;
  final rounded = perMinute.roundToDouble();
  final exact = rounded > 0 && (perMinute - rounded).abs() < 0.001;

  return exact
      ? AppL10n.current.shFareWaitingRate(
          minutes,
          Formatters.formatSom(rounded),
        )
      : AppL10n.current.shFareWaiting(minutes);
}

/// Chekning matnli ko'rinishi — "Nusxalash" tugmasi shuni buferga qo'yadi.
///
/// `share_plus` hali loyihaga qo'shilmagani uchun ulashish o'rniga nusxalash
/// ishlatiladi; matn odam o'qiy oladigan qilib tuzilgan, chunki u
/// qo'llab-quvvatlash chatiga yoki messenjerga tashlanadi.
String receiptAsText(OrderReceipt receipt) {
  final l10n = AppL10n.current;
  final buffer = StringBuffer()
    ..writeln(l10n.shReceiptHeader)
    ..writeln(l10n.shReceiptOrder(receipt.orderNumber));

  if (receipt.completedAt != null) {
    buffer.writeln(
      l10n.shReceiptDate(Formatters.formatDateTime(receipt.completedAt!)),
    );
  }
  final serviceLabel = receiptServiceTypeLabel(receipt.serviceType);
  if (serviceLabel != null) buffer.writeln(l10n.shReceiptService(serviceLabel));
  if (receipt.tariffName != null) {
    buffer.writeln(l10n.shReceiptTariff(receipt.tariffName!));
  }

  buffer.writeln();
  buffer.writeln(
    l10n.shReceiptPickup(receipt.pickupAddress ?? l10n.shReceiptNotSaved),
  );
  for (var i = 0; i < receipt.waypoints.length; i++) {
    buffer.writeln(l10n.shReceiptStop(i + 1, receipt.waypoints[i].address));
  }
  buffer.writeln(
    l10n.shReceiptDropoff(receipt.dropoffAddress ?? l10n.shReceiptNotSaved),
  );

  if (receipt.distanceKm != null) {
    buffer.writeln(
      l10n.shReceiptDistance(
        Formatters.formatDistance(receipt.distanceKm! * 1000),
      ),
    );
  }
  if (receipt.durationMin != null) {
    buffer.writeln(
      l10n.shReceiptDuration(
        Formatters.formatDuration(receipt.durationMin!),
      ),
    );
  }

  buffer.writeln();
  final fare = receipt.fare;
  if (fare == null) {
    buffer.writeln(l10n.shReceiptNoFareBreakdown);
  } else {
    for (final line in fareLines(fare)) {
      buffer.writeln('${line.label}: ${line.value}');
    }
  }

  // Ekrandagi tartib bilan AYNAN bir xil: oraliq "Jami" faqat undan keyin
  // o'zgartiruvchi qator kelsa yoziladi, aks holda u "Yakuniy" ni takrorlab,
  // matnda bir xil son ikki marta turadi.
  final hasAdjustments = receipt.discountAmount > 0 || receipt.tipAmount > 0;
  if (hasAdjustments) {
    buffer.writeln(
      l10n.shReceiptTotal(
        formatSomRounded(fare?.total ?? receipt.grossPrice),
      ),
    );
    if (receipt.discountAmount > 0) {
      final promo = receipt.promoCode != null ? ' (${receipt.promoCode})' : '';
      buffer.writeln(
        l10n.shReceiptDiscount(
          promo,
          formatSomRounded(receipt.discountAmount),
        ),
      );
    }
    if (receipt.tipAmount > 0) {
      buffer.writeln(
        l10n.shReceiptTip(formatSomRounded(receipt.tipAmount)),
      );
    }
  }
  buffer.writeln(
    l10n.shReceiptGrandTotal(formatSomRounded(receipt.grandTotal)),
  );

  buffer.writeln();
  final payment = [
    if (receipt.paymentMethod != null) receipt.paymentMethod!.label,
    if (receipt.paymentStatus != null) receipt.paymentStatus!.label,
  ].join(' · ');
  if (payment.isNotEmpty) buffer.writeln(l10n.shReceiptPayment(payment));
  if (receipt.hasUnpaidAmount) {
    buffer.writeln(
      l10n.shReceiptUnpaid(formatSomRounded(receipt.unpaidAmount)),
    );
  }

  final driver = receipt.driver;
  if (driver != null) {
    final car = [
      if (driver.carModel != null) driver.carModel!,
      if (driver.carNumber != null) driver.carNumber!,
    ].join(' · ');
    buffer.writeln(
      l10n.shReceiptDriver(
        '${driver.name}${car.isEmpty ? '' : ' · $car'}',
      ),
    );
  }

  return buffer.toString().trimRight();
}

/// To'lov holati rangi. `pending` — sariq (diqqat talab qiladi), `failed` —
/// qizil, `refunded` — neytral: pul qaytgan, bu na yutuq, na xato.
