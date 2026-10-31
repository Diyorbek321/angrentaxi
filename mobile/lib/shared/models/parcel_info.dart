import 'package:equatable/equatable.dart';

// ============================================================================
// POSILKA — shahar ichida buyum/hujjat yetkazish (2-versiya).
//
// Backend `details` ga qabul qiluvchi va buyum tavsifini yozadi
// (backend: modules/orders/parcel.ts). Topshirish PIN bilan: kodni faqat
// yuboruvchi ko'radi ([Order.deliveryPin]), haydovchi esa uni qabul
// qiluvchidan so'rab kiritadi.
// ============================================================================

const String kParcelSizeSmall = 'small';
const String kParcelSizeMedium = 'medium';
const String kParcelSizeLarge = 'large';
const List<String> kParcelSizes = [kParcelSizeSmall, kParcelSizeMedium, kParcelSizeLarge];

class ParcelInfo extends Equatable {
  const ParcelInfo({
    required this.recipientPhone,
    required this.itemDescription,
    required this.size,
    this.recipientName,
  });

  final String recipientPhone;
  final String? recipientName;
  final String itemDescription;

  /// [kParcelSizeSmall] · [kParcelSizeMedium] · [kParcelSizeLarge].
  final String size;

  /// Buyurtma yaratishda serverga yuboriladigan `details`.
  Map<String, dynamic> toDetails() => {
        'recipientPhone': recipientPhone,
        if (recipientName != null && recipientName!.isNotEmpty) 'recipientName': recipientName,
        'itemDescription': itemDescription,
        'size': size,
      };

  /// `details` posilka buyurtmasiga tegishli bo'lsagina qiymat qaytaradi.
  /// Buzuq maydon butun buyurtmani yiqitmasligi uchun zaxira bilan o'qiladi.
  static ParcelInfo? fromDetails(String serviceType, dynamic details) {
    if (serviceType != 'parcel' || details is! Map) return null;
    final phone = details['recipientPhone'];
    final item = details['itemDescription'];
    if (phone is! String || item is! String) return null;
    final size = details['size'];
    final name = details['recipientName'];
    return ParcelInfo(
      recipientPhone: phone,
      recipientName: name is String && name.trim().isNotEmpty ? name.trim() : null,
      itemDescription: item,
      size: kParcelSizes.contains(size) ? size as String : kParcelSizeSmall,
    );
  }

  @override
  List<Object?> get props => [recipientPhone, recipientName, itemDescription, size];
}
