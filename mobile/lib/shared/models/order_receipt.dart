import 'package:angren_taxi/shared/models/order.dart';
import 'package:equatable/equatable.dart';

// ============================================================================
// Tugagan safar cheki — `GET /orders/:id/receipt`
// (backend/src/modules/orders/dto/order-receipt.dto.ts).
//
// NEGA `Order` MODELIDAN ALOHIDA: `Order` — safarning JONLI holati (u
// buyurtma davomida o'zgarib turadi), chek esa safar tugagan lahzadagi
// MOLIYAVIY HUJJAT. Ikkalasini bitta modelga tiqish chekni "hozirgi tarif"
// bilan qayta hisoblash vasvasasini tug'diradi — bu esa chekni yolg'onchiga
// aylantiradi.
//
// ⚠️ Chekda komissiya va haydovchi daromadi ATAYLAB yo'q — backend ularni
// umuman yubormaydi.
// ============================================================================

/// Safar narxining qatorlarga ajratilgan tarkibi.
///
/// NEGA ALOHIDA KLASS VA NEGA NULL BO'LA OLADI: tarkib safar tugagan lahzada
/// `orders.fare_breakdown` ga MUZLATIB yoziladi. Bu ustun paydo bo'lishidan
/// oldingi safarlarda u yo'q va uni tiklab bo'lmaydi — o'shanda qaysi tarif
/// amal qilganini endi hech kim bilmaydi. Shuning uchun bu tur nullable
/// bo'lib qoladi, va ekran tarkib yo'qligini ochiq aytadi.
///
/// ⚠️ INVARIANT (backend `tariffs/fare-breakdown.ts` da qo'riqlanadi):
///
///   baseFare + distanceFare + timeFare
///     + minPriceAdjustment + surgeFare + maxPriceCap
///     + waitingFare == total
///
/// Chek ekrani qatorlarni AYNAN shu tartibda chiqaradi — shunda foydalanuvchi
/// jamini o'zi qo'shib tekshira oladi. Tartibni o'zgartirish hujjatni
/// tekshirib bo'lmaydigan qilib qo'yadi.
class FareBreakdown extends Equatable {
  const FareBreakdown({
    required this.baseFare,
    required this.distanceKm,
    required this.pricePerKm,
    required this.distanceFare,
    required this.durationMin,
    required this.pricePerMin,
    required this.timeFare,
    required this.minPriceAdjustment,
    required this.surgeMultiplier,
    required this.surgeFare,
    required this.maxPriceCap,
    required this.waitingMinutes,
    required this.waitingFare,
    required this.total,
  });

  /// Tarifning boshlang'ich haqi.
  final double baseFare;

  final double distanceKm;
  final double pricePerKm;

  /// `distanceKm * pricePerKm`.
  final double distanceFare;

  /// Kasr bo'lishi mumkin (masalan 18.5 daqiqa), shuning uchun `int` emas.
  final double durationMin;
  final double pricePerMin;

  /// `durationMin * pricePerMin`.
  final double timeFare;

  /// "Eng kam haq" tuzatmasi. Har doim >= 0.
  ///
  /// Alohida qator sifatida ko'rsatiladi, chunki "2 km yurdim, nega 15 000
  /// so'm?" degan savolga javob AYNAN shu qator bo'ladi.
  final double minPriceAdjustment;

  /// Qo'llanilgan talab koeffitsienti (1.0 = odatiy narx).
  final double surgeMultiplier;

  /// Koeffitsient qo'shgan summa. Koeffitsient 1.0 bo'lsa — 0.
  final double surgeFare;

  /// Yuqori chegara kesib tashlagan summa. Har doim <= 0 — manfiy bo'lgani
  /// uchun jamiga to'g'ridan-to'g'ri qo'shiladi va invariant saqlanadi.
  final double maxPriceCap;

  /// HAQ OLINADIGAN kutish daqiqalari — BEPUL DAQIQALAR ALLAQACHON AYIRILGAN.
  ///
  /// Ya'ni bu "haydovchi qancha kutdi" EMAS, "necha daqiqa uchun pul olindi".
  /// Backend uni butun son qilib yuboradi (`waiting-charge.ts`: har BOSHLANGAN
  /// daqiqa to'liq hisoblanadi), shuning uchun bu yerda ham `int` — kasr
  /// daqiqa chekda ko'rsatilsa, u to'lov bilan mos kelmagandek ko'rinardi.
  final int waitingMinutes;

  /// `waitingMinutes * tarifning kutish daqiqa narxi`, so'm.
  ///
  /// ⚠️ QAT'IY NARXLI SAFARDA HAM NOLDAN FARQLI BO'LADI. Kutish haqi qat'iy
  /// narx kafolatidan TASHQARIDA: kafolat marshrut noaniqligini yopadi
  /// (uni haydovchi boshqarmaydi), kutish esa yo'lovchi boshqaradigan
  /// xarajat. Shuning uchun chek bu qatorni ALOHIDA ko'rsatadi va ilovadagi
  /// "narx belgilangan" va'dasi ham shu istisnoni aytishi SHART.
  ///
  /// ⚠️ ESKI SAFARLARDA maydon JSON'da UMUMAN YO'Q (migratsiyadan oldin
  /// yozilgan `fare_breakdown`) — o'sha holatda 0 bo'lib o'qiladi va chek
  /// avvalgidek qo'shiladi.
  final double waitingFare;

  /// Chegirmagacha bo'lgan yakuniy summa.
  final double total;

  factory FareBreakdown.fromJson(Map<String, dynamic> json) {
    return FareBreakdown(
      baseFare: _num(json['baseFare']),
      distanceKm: _num(json['distanceKm']),
      pricePerKm: _num(json['pricePerKm']),
      distanceFare: _num(json['distanceFare']),
      durationMin: _num(json['durationMin']),
      pricePerMin: _num(json['pricePerMin']),
      timeFare: _num(json['timeFare']),
      minPriceAdjustment: _num(json['minPriceAdjustment']),
      // Koeffitsient yo'q bo'lsa 1.0 — "koeffitsient qo'llanmagan" degani.
      // 0.0 bo'lsa ekranda "×0.0" ko'rinib, ma'nosiz bo'lardi.
      surgeMultiplier: _num(json['surgeMultiplier'], fallback: 1),
      surgeFare: _num(json['surgeFare']),
      maxPriceCap: _num(json['maxPriceCap']),
      // Eski safarlarda ikkala kalit ham yo'q — 0 (kutish undirilmagan).
      waitingMinutes: (json['waitingMinutes'] as num?)?.round() ?? 0,
      waitingFare: _num(json['waitingFare']),
      total: _num(json['total']),
    );
  }

  @override
  List<Object?> get props => [
        baseFare,
        distanceKm,
        pricePerKm,
        distanceFare,
        durationMin,
        pricePerMin,
        timeFare,
        minPriceAdjustment,
        surgeMultiplier,
        surgeFare,
        maxPriceCap,
        waitingMinutes,
        waitingFare,
        total,
      ];
}

/// Chekdagi haydovchi — FAQAT identifikatsiya uchun.
///
/// Bu yerda baho ham, telefon raqami ham yo'q: backend ularni chekka
/// qo'shmaydi (safar tugagach haydovchiga qo'ng'iroq qilish oqimi boshqa
/// ekranlarda). Mashina modeli va raqami null bo'lishi mumkin — haydovchi
/// profili to'ldirilmagan bo'lsa.
class ReceiptDriver extends Equatable {
  const ReceiptDriver({
    required this.name,
    this.carModel,
    this.carNumber,
  });

  final String name;
  final String? carModel;
  final String? carNumber;

  factory ReceiptDriver.fromJson(Map<String, dynamic> json) {
    return ReceiptDriver(
      name: (json['name'] as String?) ?? 'Haydovchi',
      carModel: _text(json['carModel']),
      carNumber: _text(json['carNumber']),
    );
  }

  @override
  List<Object?> get props => [name, carModel, carNumber];
}

/// Backend `PaymentMethod` (order.entity.ts).
enum ReceiptPaymentMethod { cash, card, wallet }

extension ReceiptPaymentMethodLabel on ReceiptPaymentMethod {
  String get label => switch (this) {
        ReceiptPaymentMethod.cash => 'Naqd pul',
        ReceiptPaymentMethod.card => 'Karta',
        ReceiptPaymentMethod.wallet => 'Hamyon',
      };
}

/// Noma'lum qiymat uchun `null` qaytariladi — o'ylab topilgan usul
/// ko'rsatilgandan ko'ra qatorni umuman chiqarmagan yaxshi.
ReceiptPaymentMethod? receiptPaymentMethodFromString(String? value) {
  return switch (value) {
    'cash' => ReceiptPaymentMethod.cash,
    'card' => ReceiptPaymentMethod.card,
    'wallet' => ReceiptPaymentMethod.wallet,
    _ => null,
  };
}

/// Backend `TransactionStatus` (transaction.entity.ts).
enum ReceiptPaymentStatus { pending, completed, failed, refunded }

extension ReceiptPaymentStatusLabel on ReceiptPaymentStatus {
  String get label => switch (this) {
        ReceiptPaymentStatus.pending => 'Kutilmoqda',
        ReceiptPaymentStatus.completed => "To'landi",
        ReceiptPaymentStatus.failed => 'Amalga oshmadi',
        ReceiptPaymentStatus.refunded => 'Qaytarildi',
      };
}

ReceiptPaymentStatus? receiptPaymentStatusFromString(String? value) {
  return switch (value) {
    'pending' => ReceiptPaymentStatus.pending,
    'completed' => ReceiptPaymentStatus.completed,
    'failed' => ReceiptPaymentStatus.failed,
    'refunded' => ReceiptPaymentStatus.refunded,
    _ => null,
  };
}

/// Xizmat turi nomi. Noma'lum tur uchun `null` — chek sarlavhasida
/// tanimagan so'zni chiqarib yubormaslik uchun.
String? receiptServiceTypeLabel(String? serviceType) {
  return switch (serviceType) {
    'taxi' => 'Taksi',
    'cargo' => 'Yuk tashish',
    'food' => 'Ovqat yetkazish',
    'market' => "Do'kon yetkazish",
    _ => null,
  };
}

/// Tugagan safar cheki.
class OrderReceipt extends Equatable {
  const OrderReceipt({
    required this.orderId,
    required this.orderNumber,
    required this.serviceType,
    required this.waypoints,
    required this.tariffId,
    required this.surgeMultiplier,
    required this.grossPrice,
    required this.discountAmount,
    required this.tipAmount,
    required this.total,
    required this.unpaidAmount,
    this.completedAt,
    this.pickupAddress,
    this.dropoffAddress,
    this.tariffName,
    this.distanceKm,
    this.durationMin,
    this.fare,
    this.promoCode,
    this.paymentMethod,
    this.paymentStatus,
    this.driver,
  });

  final String orderId;

  /// Qo'llab-quvvatlashga aytiladigan qisqa raqam ("A3F9C1D2"). To'liq UUID
  /// telefonda o'qib bo'lmaydi, shuning uchun backend uni qisqartirib beradi.
  final String orderNumber;

  final DateTime? completedAt;
  final String serviceType;

  final String? pickupAddress;
  final String? dropoffAddress;

  /// Oraliq to'xtashlar. `OrderLocation` QAYTA ISHLATILADI — backend bu
  /// yerda ham aynan `{address, lat, lng}` yuboradi va ikkinchi bir xil
  /// modelni saqlash ikkalasining vaqt o'tib ajralib ketishiga olib keladi.
  final List<OrderLocation> waypoints;

  final String tariffId;
  final String? tariffName;

  /// Haqiqiy o'lchovlar (`trips` jadvalidan). Eski safarlarda null.
  final double? distanceKm;
  final int? durationMin;

  /// ⚠️ Eski safarlarda null — [FareBreakdown] izohiga qarang.
  final FareBreakdown? fare;

  final double surgeMultiplier;

  /// Chegirmagacha bo'lgan summa.
  final double grossPrice;
  final double discountAmount;
  final String? promoCode;

  /// Chaqim — komissiyasiz, to'liq haydovchiga.
  final double tipAmount;

  /// Safar uchun undirilgan summa (chegirma ayirilgan, chaqimsiz).
  final double total;

  final ReceiptPaymentMethod? paymentMethod;
  final ReceiptPaymentStatus? paymentStatus;

  /// To'lanmagan qoldiq: hamyonda mablag' yetmagan yoki karta to'lovi hali
  /// provayder tomonidan yopilmagan.
  final double unpaidAmount;

  final ReceiptDriver? driver;

  /// Yo'lovchi jami to'lagan summa: safar haqi + chaqim.
  ///
  /// NEGA QO'SHIB HISOBLANADI: backend'dagi `total` — FAQAT yo'l haqi.
  /// Chaqim alohida hamyon tranzaksiyasi bo'lgani uchun unga KIRMAYDI
  /// (orders-tips.service.ts: `driverEarning` ga ham qo'shilmaydi). Chekda
  /// ikkala summa bitta ustunda turgani uchun yakuniy qator ikkalasining
  /// yig'indisi bo'lishi SHART — aks holda qatorlar ko'zga ko'rinib jamiga
  /// qo'shilmay qoladi.
  double get grandTotal => total + tipAmount;

  bool get hasUnpaidAmount => unpaidAmount > 0;

  factory OrderReceipt.fromJson(Map<String, dynamic> json) {
    final rawWaypoints = json['waypoints'];

    return OrderReceipt(
      orderId: (json['orderId'] as String?) ?? '',
      orderNumber: (json['orderNumber'] as String?) ?? '',
      completedAt: _date(json['completedAt']),
      serviceType: (json['serviceType'] as String?) ?? 'taxi',
      pickupAddress: _text(json['pickupAddress']),
      dropoffAddress: _text(json['dropoffAddress']),
      waypoints: rawWaypoints is List
          ? rawWaypoints
              .whereType<Map<String, dynamic>>()
              .map(OrderLocation.fromJson)
              .toList(growable: false)
          : const <OrderLocation>[],
      tariffId: (json['tariffId'] as String?) ?? '',
      tariffName: _text(json['tariffName']),
      distanceKm: (json['distanceKm'] as num?)?.toDouble(),
      durationMin: (json['durationMin'] as num?)?.round(),
      fare: json['fare'] is Map<String, dynamic>
          ? FareBreakdown.fromJson(json['fare'] as Map<String, dynamic>)
          : null,
      surgeMultiplier: _num(json['surgeMultiplier'], fallback: 1),
      grossPrice: _num(json['grossPrice']),
      discountAmount: _num(json['discountAmount']),
      promoCode: _text(json['promoCode']),
      tipAmount: _num(json['tipAmount']),
      total: _num(json['total']),
      paymentMethod: receiptPaymentMethodFromString(
        json['paymentMethod'] as String?,
      ),
      paymentStatus: receiptPaymentStatusFromString(
        json['paymentStatus'] as String?,
      ),
      unpaidAmount: _num(json['unpaidAmount']),
      driver: json['driver'] is Map<String, dynamic>
          ? ReceiptDriver.fromJson(json['driver'] as Map<String, dynamic>)
          : null,
    );
  }

  @override
  List<Object?> get props => [
        orderId,
        orderNumber,
        completedAt,
        serviceType,
        pickupAddress,
        dropoffAddress,
        waypoints,
        tariffId,
        tariffName,
        distanceKm,
        durationMin,
        fare,
        surgeMultiplier,
        grossPrice,
        discountAmount,
        promoCode,
        tipAmount,
        total,
        paymentMethod,
        paymentStatus,
        unpaidAmount,
        driver,
      ];
}

/// Pul maydonlari uchun bitta joyda turgan o'qish qoidasi: `null` yoki
/// noto'g'ri tur kelsa 0 (yoki berilgan zaxira) qaytadi. Chek ekranida
/// `null` tekshiruvi har bir maydonda takrorlanmasligi uchun shu yerda.
double _num(Object? value, {double fallback = 0}) {
  return value is num ? value.toDouble() : fallback;
}

/// Bo'sh satrni `null` ga aylantiradi — UI "bor, lekin bo'sh" qatorni
/// chiqarib yubormasligi uchun.
String? _text(Object? value) {
  if (value is! String) return null;
  final trimmed = value.trim();
  return trimmed.isEmpty ? null : trimmed;
}

DateTime? _date(Object? value) {
  if (value is! String) return null;
  return DateTime.tryParse(value);
}
