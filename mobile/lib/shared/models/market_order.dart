import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/address_details.dart';
import 'package:angren_taxi/shared/models/courier_tracking.dart';
import 'package:angren_taxi/shared/models/order.dart' show OrderStatus;
import 'package:equatable/equatable.dart';

enum MarketOrderStatus { newOrder, packing, shipped, delivered, cancelled, returning, returned }

extension MarketOrderStatusExtension on MarketOrderStatus {
  String get label {
    switch (this) {
      case MarketOrderStatus.newOrder:
        return AppL10n.current.shDeliveryAccepted;
      case MarketOrderStatus.packing:
        return AppL10n.current.shMarketPacking;
      case MarketOrderStatus.shipped:
        return AppL10n.current.shDeliveryOnTheWay;
      case MarketOrderStatus.delivered:
        return AppL10n.current.shDeliveryDelivered;
      case MarketOrderStatus.cancelled:
        return AppL10n.current.shStatusCancelled;
      case MarketOrderStatus.returning:
        return AppL10n.current.shDeliveryReturning;
      case MarketOrderStatus.returned:
        return AppL10n.current.shDeliveryReturned;
    }
  }

  /// Qaytarish oqimi (docs/INCIDENT-POLICY.md §2): kuryer topshira olmadi.
  /// `returning` FAOL hisoblanmaydi — bekor qilish va kuzatuv yo'q — lekin
  /// tugagan ham emas: `returned` hodisasi hali keladi.
  bool get isReturnFlow =>
      this == MarketOrderStatus.returning || this == MarketOrderStatus.returned;

  bool get isActive =>
      this == MarketOrderStatus.newOrder ||
      this == MarketOrderStatus.packing ||
      this == MarketOrderStatus.shipped;
}

// Backend's MarketOrder.status wire values (market-order.entity.ts):
// new/packing/shipped/delivered/cancelled/returning/returned.
MarketOrderStatus marketOrderStatusFromString(String status) {
  switch (status) {
    case 'new':
      return MarketOrderStatus.newOrder;
    case 'packing':
      return MarketOrderStatus.packing;
    case 'shipped':
      return MarketOrderStatus.shipped;
    case 'delivered':
      return MarketOrderStatus.delivered;
    case 'cancelled':
      return MarketOrderStatus.cancelled;
    case 'returning':
      return MarketOrderStatus.returning;
    case 'returned':
      return MarketOrderStatus.returned;
    default:
      return MarketOrderStatus.newOrder;
  }
}

class MarketOrderItem extends Equatable {
  const MarketOrderItem({
    required this.productId,
    required this.name,
    required this.qty,
    required this.price,
    required this.packed,
  });

  final String productId;
  final String name;
  final int qty;
  final double price;
  final bool packed;

  factory MarketOrderItem.fromJson(Map<String, dynamic> json) {
    return MarketOrderItem(
      productId: json['productId'] as String,
      name: json['name'] as String,
      qty: (json['qty'] as num).toInt(),
      price: (json['price'] as num).toDouble(),
      packed: (json['packed'] as bool?) ?? false,
    );
  }

  @override
  List<Object?> get props => [productId, name, qty, price, packed];
}

class MarketOrder extends Equatable {
  const MarketOrder({
    required this.id,
    required this.storeId,
    required this.status,
    required this.items,
    required this.deliveryAddress,
    required this.totalPrice,
    required this.createdAt,
    this.delivery,
    this.canCancelFlag,
    this.cancelReason,
    this.cancelledBy,
    this.promoCode,
    this.promoDiscount = 0,
    this.promotionDiscount = 0,
    this.addressDetails,
    double? payableTotal,
    this.paymentPending = false,
    this.returnedAt,
    this.returnCharge,
    this.refundDue,
    this.refundStatus,
  }) : _payableTotal = payableTotal;

  /// Qaytarish tasdiqlangan lahza.
  final DateTime? returnedAt;

  /// Mijoz to'laydigan: yetkazish haqi + kutish + qaytarish haqi, so'm.
  final double? returnCharge;

  /// Kartali buyurtma: mijozga qaytariladigan summa, so'm. Naqdda `null`.
  final double? refundDue;

  /// `pending` — qaytarish kutilmoqda; `done` — qaytarildi.
  final String? refundStatus;

  /// Kartali buyurtmaning to'lovi hali tushmagan (server `paymentPending`,
  /// docs/INCIDENT-POLICY.md §1). Sotuvchi to'lovgacha qabul qilmaydi; ilova
  /// "To'lov kutilmoqda" va qayta to'lash tugmasini ko'rsatadi.
  final bool paymentPending;

  final String id;
  final String storeId;
  final MarketOrderStatus status;
  final List<MarketOrderItem> items;
  final String deliveryAddress;
  final double totalPrice;
  final DateTime createdAt;

  /// Kuryer safari — do'kon/restoran kuryer chaqirgandan keyin paydo
  /// bo'ladi. `null` — hali chaqirilmagan.
  final CourierTracking? delivery;

  /// Server `canCancel` bayrog'i (spec v5 §1). Eski server bermaydi — `null`.
  final bool? canCancelFlag;
  final String? cancelReason;

  /// `customer` / `vendor` / `admin` — kim bekor qilgan.
  final String? cancelledBy;

  final String? promoCode;

  /// Promokod chegirmasi (platforma hisobidan), so'm.
  final double promoDiscount;

  /// Vendor aksiyalari chegirmasi, so'm.
  final double promotionDiscount;

  final double? _payableTotal;

  /// Mijoz TO'LAYDIGAN summa (spec v5 §6): `totalPrice` promokod
  /// chegirmasini o'z ichiga OLMAYDI. Eski server `payableTotal` bermaydi —
  /// u holda `totalPrice − promoDiscount`.
  double get payableTotal =>
      _payableTotal ?? (totalPrice - promoDiscount).clamp(0, double.infinity).toDouble();

  /// Podyezd/qavat/xonadon... — `null` bo'lishi mumkin.
  final AddressDetails? addressDetails;

  /// Yo'lovchi buyurtmani o'zi bekor qila oladimi.
  ///
  /// Server bayrog'i bo'lsa — faqat unga ishoniladi. Eski server bayroq
  /// bermaydi: u holda spec qoidasi qo'llanadi — vendor hali QABUL
  /// QILMAGAN (`new`) buyurtma. Tugagan buyurtma hech qachon bekor
  /// qilinmaydi.
  bool get canCancel {
    if (!status.isActive) return false;
    return canCancelFlag ?? status == MarketOrderStatus.newOrder;
  }

  /// Mijoz kuryerni xaritada kuzata oladimi: buyurtma hali yo'lda va unga
  /// kuryer safari bog'langan (bekor qilingan safar — qayta qidirilmoqda,
  /// kuzatadigan mashina yo'q).
  bool get isTrackable =>
      status.isActive &&
      delivery != null &&
      delivery!.status != OrderStatus.cancelled;

  int get itemsCount => items.fold(0, (sum, i) => sum + i.qty);

  factory MarketOrder.fromJson(Map<String, dynamic> json) {
    return MarketOrder(
      id: json['id'] as String,
      storeId: json['storeId'] as String,
      status: marketOrderStatusFromString(json['status'] as String),
      items: ((json['items'] as List<dynamic>?) ?? [])
          .map((e) => MarketOrderItem.fromJson(e as Map<String, dynamic>))
          .toList(),
      deliveryAddress: (json['deliveryAddress'] as String?) ?? '',
      totalPrice: (json['totalPrice'] as num).toDouble(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      delivery: CourierTracking.tryParse(json['delivery']),
      canCancelFlag: json['canCancel'] as bool?,
      cancelReason: json['cancelReason'] as String?,
      cancelledBy: json['cancelledBy'] as String?,
      promoCode: json['promoCode'] as String?,
      promoDiscount: (json['promoDiscount'] as num?)?.toDouble() ?? 0,
      promotionDiscount: (json['promotionDiscount'] as num?)?.toDouble() ?? 0,
      addressDetails: AddressDetails.tryParse(json['addressDetails']),
      payableTotal: (json['payableTotal'] as num?)?.toDouble(),
      paymentPending: (json['paymentPending'] as bool?) ?? false,
      returnedAt: json['returnedAt'] is String
          ? DateTime.tryParse(json['returnedAt'] as String)?.toLocal()
          : null,
      returnCharge: _money(json['returnCharge']),
      refundDue: _money(json['refundDue']),
      refundStatus: json['refundStatus'] as String?,
    );
  }

  /// Decimal ustun ba'zan satr bo'lib keladi — ikkalasini ham o'qiymiz.
  static double? _money(dynamic value) => switch (value) {
        final num n => n.toDouble(),
        final String s => double.tryParse(s),
        _ => null,
      };

  MarketOrder copyWith({
    MarketOrderStatus? status,
    CourierTracking? delivery,
    double? returnCharge,
    double? refundDue,
  }) {
    return MarketOrder(
      id: id,
      storeId: storeId,
      status: status ?? this.status,
      items: items,
      deliveryAddress: deliveryAddress,
      totalPrice: totalPrice,
      createdAt: createdAt,
      delivery: delivery ?? this.delivery,
      // Holat o'zgargach eski bayroq yolg'on bo'lib qoladi (masalan
      // restoran qabul qildi) — keyingi yangilanishgacha qoida ishlaydi.
      canCancelFlag: status == null || status == this.status ? canCancelFlag : null,
      cancelReason: cancelReason,
      cancelledBy: cancelledBy,
      promoCode: promoCode,
      promoDiscount: promoDiscount,
      promotionDiscount: promotionDiscount,
      addressDetails: addressDetails,
      payableTotal: _payableTotal,
      paymentPending: status == MarketOrderStatus.cancelled ? false : paymentPending,
      returnedAt: returnedAt,
      returnCharge: returnCharge ?? this.returnCharge,
      refundDue: refundDue ?? this.refundDue,
      refundStatus: refundStatus,
    );
  }

  @override
  List<Object?> get props => [id, storeId, status, items, deliveryAddress, totalPrice, createdAt, delivery, canCancelFlag, cancelReason, cancelledBy, promoCode, promoDiscount, promotionDiscount, addressDetails, _payableTotal, paymentPending, returnedAt, returnCharge, refundDue, refundStatus];
}
