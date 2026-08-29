import 'package:angren_taxi/shared/models/driver.dart';
import 'package:angren_taxi/shared/utils/waiting_charge.dart';
import 'package:equatable/equatable.dart';

enum OrderStatus {
  /// Yo'lovchi safarni kelajakdagi vaqtga rejalashtirgan. Haydovchi hali
  /// qidirilmayapti — backend cron'i `scheduled_at` yaqinlashganda buyurtmani
  /// jonli holatga o'tkazadi.
  scheduled,
  pending,
  searching,
  driverAssigned,
  driverEnRoute,
  driverArrived,
  inProgress,
  completed,
  cancelled,
}

extension OrderStatusExtension on OrderStatus {
  String get label {
    switch (this) {
      case OrderStatus.scheduled:
        return 'Rejalashtirilgan';
      case OrderStatus.pending:
        return 'Kutilmoqda';
      case OrderStatus.searching:
        return 'Haydovchi izlanmoqda';
      case OrderStatus.driverAssigned:
        return 'Haydovchi tayinlandi';
      case OrderStatus.driverEnRoute:
        return 'Haydovchi kelmoqda';
      case OrderStatus.driverArrived:
        return 'Haydovchi yetib keldi';
      case OrderStatus.inProgress:
        return 'Sayohat davom etmoqda';
      case OrderStatus.completed:
        return 'Yakunlandi';
      case OrderStatus.cancelled:
        return 'Bekor qilindi';
    }
  }
}

// Backend's actual OrderStatus enum values (order.entity.ts) are
// created/searching/accepted/arrived/in_progress/completed/cancelled — there
// is no 'pending', 'driver_assigned', or 'driver_arrived' on the wire. Map
// those real values onto the richer local enum below.
OrderStatus orderStatusFromString(String status) {
  switch (status) {
    case 'scheduled':
      return OrderStatus.scheduled;
    case 'created':
      return OrderStatus.pending;
    case 'searching':
      return OrderStatus.searching;
    case 'accepted':
      return OrderStatus.driverAssigned;
    case 'arrived':
      return OrderStatus.driverArrived;
    case 'in_progress':
      return OrderStatus.inProgress;
    case 'completed':
      return OrderStatus.completed;
    case 'cancelled':
      return OrderStatus.cancelled;
    default:
      return OrderStatus.pending;
  }
}

// ============================================================================
// XIZMAT TURI (`serviceType`) — taksi · cargo · ovqat · market.
//
// ⚠️ ENUM EMAS, ATAYLAB XOM SATR. Server yangi vertikal qo'shsa (masalan
// `pharmacy`), eski APK bu qiymatni ko'rib YIQILMASLIGI kerak. Qaysi matn
// ko'rsatilishi features/driver/service_wording.dart ning ishi va u
// noma'lum turda taksi matnlariga qaytadi.
// ============================================================================

const String kServiceTypeTaxi = 'taxi';
const String kServiceTypeCargo = 'cargo';
const String kServiceTypeFood = 'food';
const String kServiceTypeMarket = 'market';

/// Xom qiymatni normallashtiradi.
///
/// Maydon umuman kelmasa `taxi` qaytadi — bu ZAXIRA emas, ZARURAT: eski
/// buyurtmalarda va `serviceType` yubormaydigan realtime paketlarida bu
/// maydon yo'q, ular esa aynan taksi buyurtmalari.
String serviceTypeFromApi(dynamic value) {
  final raw = value is String ? value.trim().toLowerCase() : '';
  return raw.isEmpty ? kServiceTypeTaxi : raw;
}

class OrderLocation extends Equatable {
  const OrderLocation({
    required this.address,
    required this.lat,
    required this.lng,
  });

  final String address;
  final double lat;
  final double lng;

  factory OrderLocation.fromJson(Map<String, dynamic> json) {
    return OrderLocation(
      address: (json['address'] as String?) ?? '',
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'address': address,
        'lat': lat,
        'lng': lng,
      };

  @override
  List<Object?> get props => [address, lat, lng];
}

class Order extends Equatable {
  const Order({
    required this.id,
    required this.passengerId,
    required this.pickup,
    required this.dropoff,
    required this.status,
    required this.estimatedPrice,
    required this.createdAt,
    this.driver,
    this.actualPrice,
    this.tariffId,
    this.completedAt,
    this.cancelReason,
    this.distanceKm,
    this.durationMin,
    this.passengerPhone,
    this.passengerName,
    this.scheduledAt,
    this.serviceType = kServiceTypeTaxi,
    this.arrivedAt,
    this.freeWaitMinutes = kDefaultFreeWaitMinutes,
    this.waitingPricePerMinute = kDefaultWaitingPricePerMinute,
  });

  final String id;
  final String passengerId;
  final OrderLocation pickup;
  final OrderLocation dropoff;
  final OrderStatus status;
  final double estimatedPrice;
  final DateTime createdAt;
  final Driver? driver;
  final double? actualPrice;
  final String? tariffId;
  final DateTime? completedAt;
  final String? cancelReason;
  final double? distanceKm;
  final int? durationMin;
  final String? passengerPhone;
  final String? passengerName;

  /// Rejalashtirilgan olib ketish vaqti, MAHALLIY vaqtda. `null` = odatdagi
  /// "hozir" buyurtmasi.
  ///
  /// Backend `timestamptz` yuboradi (UTC), shuning uchun `fromJson` da
  /// `.toLocal()` qilinadi — usiz O'zbekistonda (UTC+5) ekranda 5 soatlik
  /// xato ko'rinardi.
  final DateTime? scheduledAt;

  /// Buyurtma qaysi vertikaldan kelgani: `taxi` · `cargo` · `food` ·
  /// `market` (yoki server kelajakda qo'shadigan boshqa qiymat).
  ///
  /// Haydovchi ekranlaridagi BUTUN matn shu maydonga bog'langan: ovqat
  /// buyurtmasida olish nuqtasi restoran, market'da esa do'kon bo'ladi.
  /// Tanlash faqat bitta joyda — features/driver/service_wording.dart.
  final String serviceType;

  // ==========================================================================
  // KUTISH SHARTNOMASI — uchta maydon BIRGA keladi va birga ishlatiladi.
  //
  // Backend ularni HAR BIR buyurtma javobiga `attachDisplayFields` orqali
  // ildizga tekislab qo'yadi (`order.tariff` ichida EMAS): GET /orders/:id,
  // /orders/active, /orders/my, ro'yxatlar — hammasida bir xil uchtasi bor.
  // Shuning uchun ilova tarif munosabati yuklanganiga tayanmaydi.
  //
  // Bu uchtadan hisoblangan raqam HAYDOVCHIDA HAM, YO'LOVCHIDA HAM bir xil
  // bo'ladi va u pul undiradigan server hisobining aynan o'zi —
  // lib/shared/utils/waiting_charge.dart ga qarang.
  // ==========================================================================

  /// Haydovchi "yetib keldim" bosgan lahza, MAHALLIY vaqtda.
  ///
  /// `null` = haydovchi hali bosmagan YOKI buyurtma kutish migratsiyasidan
  /// oldin yaratilgan. Ikkala holatda ham hisoblagich UMUMAN
  /// ko'rsatilmaydi — nol turgan hisoblagich "kutish boshlandi" degan
  /// yolg'on ma'no berardi.
  ///
  /// Backend `timestamptz` (UTC) yuboradi, shuning uchun `fromJson` da
  /// `.toLocal()` — `scheduledAt` bilan bir xil sabab: usiz O'zbekistonda
  /// (UTC+5) ekranda 5 soatlik xato ko'rinardi.
  final DateTime? arrivedAt;

  /// Bepul kutish oynasi, daqiqa. Buyurtma tarifidan keladi.
  ///
  /// Maydon javobda umuman bo'lmasa (eski server) zaxira qiymat
  /// [kDefaultFreeWaitMinutes] ishlatiladi — `null` bo'lib hisobni
  /// `NaN` ga aylantirmasligi uchun.
  final int freeWaitMinutes;

  /// Bepul oynadan keyingi har bir BOSHLANGAN daqiqa narxi, so'm.
  /// Zaxira qiymat [kDefaultWaitingPricePerMinute].
  final int waitingPricePerMinute;

  factory Order.fromJson(Map<String, dynamic> json) {
    return Order(
      id: json['id'] as String,
      passengerId: json['passengerId'] as String,
      pickup: OrderLocation.fromJson(
        json['pickup'] as Map<String, dynamic>,
      ),
      dropoff: OrderLocation.fromJson(
        json['dropoff'] as Map<String, dynamic>,
      ),
      status: orderStatusFromString(json['status'] as String),
      estimatedPrice: (json['estimatedPrice'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      driver: json['driver'] != null
          ? Driver.fromJson(json['driver'] as Map<String, dynamic>)
          : null,
      actualPrice: json['finalPrice'] != null
          ? (json['finalPrice'] as num).toDouble()
          : null,
      tariffId: json['tariffId'] as String?,
      completedAt: json['completedAt'] != null
          ? DateTime.parse(json['completedAt'] as String)
          : null,
      cancelReason: json['cancelReason'] as String?,
      distanceKm: json['distanceKm'] != null
          ? (json['distanceKm'] as num).toDouble()
          : null,
      durationMin: json['durationMin'] as int?,
      passengerPhone: json['passenger'] != null
          ? (json['passenger'] as Map<String, dynamic>)['phone'] as String?
          : null,
      passengerName: json['passenger'] != null
          ? [
              (json['passenger'] as Map<String, dynamic>)['firstName'],
              (json['passenger'] as Map<String, dynamic>)['lastName'],
            ].whereType<String>().where((s) => s.isNotEmpty).join(' ')
          : null,
      scheduledAt: json['scheduledAt'] != null
          ? DateTime.parse(json['scheduledAt'] as String).toLocal()
          : null,
      serviceType: serviceTypeFromApi(json['serviceType']),
      // ⚠️ `tryParse`, `parse` EMAS: yaroqsiz sana matni kelsa hisoblagich
      // ko'rsatilmasligi kerak, `Order.fromJson` esa YIQILMASLIGI kerak —
      // aks holda bitta buzuq maydon butun faol safar ekranini o'ldirardi.
      arrivedAt: json['arrivedAt'] is String
          ? DateTime.tryParse(json['arrivedAt'] as String)?.toLocal()
          : null,
      // ⚠️ ORQAGA MOSLIK: eski server bu maydonlarni umuman yubormaydi.
      // `?? zaxira` ularni standart tarifga qaytaradi.
      freeWaitMinutes:
          (json['freeWaitMinutes'] as num?)?.toInt() ?? kDefaultFreeWaitMinutes,
      waitingPricePerMinute: (json['waitingPricePerMinute'] as num?)?.toInt() ??
          kDefaultWaitingPricePerMinute,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'passengerId': passengerId,
        'pickup': pickup.toJson(),
        'dropoff': dropoff.toJson(),
        'status': status.name,
        'estimatedPrice': estimatedPrice,
        'createdAt': createdAt.toIso8601String(),
        'driver': driver?.toJson(),
        'actualPrice': actualPrice,
        'tariffId': tariffId,
        'completedAt': completedAt?.toIso8601String(),
        'cancelReason': cancelReason,
        'distanceKm': distanceKm,
        'durationMin': durationMin,
        'scheduledAt': scheduledAt?.toIso8601String(),
        'serviceType': serviceType,
        'arrivedAt': arrivedAt?.toIso8601String(),
        'freeWaitMinutes': freeWaitMinutes,
        'waitingPricePerMinute': waitingPricePerMinute,
      };

  /// ⚠️ `scheduled` ATAYLAB BU YERGA KIRMAYDI.
  ///
  /// `checkActiveOrder()` shu getter bo'yicha filtrlaydi va topganini
  /// `_activeOrder` ga qo'yadi. Rejalashtirilgan safar "aktiv" hisoblansa,
  /// bosh ekran "haydovchi izlanmoqda" holatiga qulflanib qolardi va
  /// yo'lovchi ertangi safari borligi uchun BUGUN taksi chaqira olmasdi.
  bool get isActive =>
      status == OrderStatus.searching ||
      status == OrderStatus.driverAssigned ||
      status == OrderStatus.driverEnRoute ||
      status == OrderStatus.driverArrived ||
      status == OrderStatus.inProgress;

  Order copyWith({
    String? id,
    String? passengerId,
    OrderLocation? pickup,
    OrderLocation? dropoff,
    OrderStatus? status,
    double? estimatedPrice,
    DateTime? createdAt,
    Driver? driver,
    double? actualPrice,
    String? tariffId,
    DateTime? completedAt,
    String? cancelReason,
    double? distanceKm,
    int? durationMin,
    DateTime? scheduledAt,
    String? serviceType,
    DateTime? arrivedAt,
    int? freeWaitMinutes,
    int? waitingPricePerMinute,
  }) {
    return Order(
      id: id ?? this.id,
      passengerId: passengerId ?? this.passengerId,
      pickup: pickup ?? this.pickup,
      dropoff: dropoff ?? this.dropoff,
      status: status ?? this.status,
      estimatedPrice: estimatedPrice ?? this.estimatedPrice,
      createdAt: createdAt ?? this.createdAt,
      driver: driver ?? this.driver,
      actualPrice: actualPrice ?? this.actualPrice,
      tariffId: tariffId ?? this.tariffId,
      completedAt: completedAt ?? this.completedAt,
      cancelReason: cancelReason ?? this.cancelReason,
      distanceKm: distanceKm ?? this.distanceKm,
      durationMin: durationMin ?? this.durationMin,
      scheduledAt: scheduledAt ?? this.scheduledAt,
      serviceType: serviceType ?? this.serviceType,
      // ⚠️ `copyWith` bu maydonni TOZALAY OLMAYDI (`??` naqshi). Buyurtma
      // boshqa haydovchiga o'tkazilganda server `arrived_at` ni nollaydi va
      // ilova o'sha yangi holatni to'liq `Order.fromJson` orqali oladi
      // (`_refreshActiveOrder` / `checkActiveOrder`), ya'ni eskirgan
      // `arrivedAt` u yerda tabiiy ravishda yo'qoladi.
      arrivedAt: arrivedAt ?? this.arrivedAt,
      freeWaitMinutes: freeWaitMinutes ?? this.freeWaitMinutes,
      waitingPricePerMinute:
          waitingPricePerMinute ?? this.waitingPricePerMinute,
    );
  }

  @override
  List<Object?> get props => [
        id,
        passengerId,
        pickup,
        dropoff,
        status,
        estimatedPrice,
        createdAt,
        driver,
        actualPrice,
        tariffId,
        completedAt,
        cancelReason,
        distanceKm,
        durationMin,
        // ⚠️ `props` GA QO'SHILISHI SHART. `Order extends Equatable`, ya'ni
        // bu yerda yo'q maydon tenglikda HISOBGA OLINMAYDI: `copyWith(
        // scheduledAt: ...)` natijasi eskisiga TENG deb topilardi va
        // `notifyListeners()` chaqirilsa ham UI yangilanmasdi.
        scheduledAt,
        serviceType,
        // `props` ga qo'shilishi SHART — yuqoridagi izohga qarang: bu yerda
        // yo'q maydon o'zgarsa `copyWith` natijasi eskisiga TENG deb
        // topilardi va kutish hisoblagichi yangilanmasdi.
        arrivedAt,
        freeWaitMinutes,
        waitingPricePerMinute,
      ];
}
