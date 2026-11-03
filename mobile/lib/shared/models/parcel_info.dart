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

/// Posilkada yuborish taqiqlangan narsalar (docs/INCIDENT-POLICY.md §2).
/// Ilovada ro'yxat ko'rsatiladi, buyurtmada yuboruvchi tasdiqlaydi.
const List<String> kParcelProhibitedItems = [
  'money',
  'documents',
  'weapons',
  'medicine',
  'alcohol',
  'live_animals',
  'drugs',
];

/// Kiritilgan qiymat matnini tekshiradi: butun son, 1..[max]. Yaroqsiz —
/// `null` (server ham shu chegarani tekshiradi).
int? parseDeclaredValue(String raw, int max) {
  final digits = raw.replaceAll(RegExp(r'\s'), '');
  final value = int.tryParse(digits);
  if (value == null || value < 1 || value > max) return null;
  return value;
}

class ParcelInfo extends Equatable {
  const ParcelInfo({
    required this.recipientPhone,
    required this.itemDescription,
    required this.size,
    this.recipientName,
    this.declaredValue,
    this.prohibitedItemsAccepted = false,
  });

  /// E'lon qilingan qiymat, so'm (1..`parcelMaxDeclaredValue`). Yangi
  /// buyurtmada majburiy; eski buyurtmalar javobida bo'lmasligi mumkin.
  final int? declaredValue;

  /// Yuboruvchi taqiqlangan narsa yo'qligini tasdiqlagan. Server faqat
  /// aynan `true` ni qabul qiladi.
  final bool prohibitedItemsAccepted;

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
        if (declaredValue != null) 'declaredValue': declaredValue,
        if (prohibitedItemsAccepted) 'prohibitedItemsAccepted': true,
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
      declaredValue: switch (details['declaredValue']) {
        final num n => n.toInt(),
        _ => null,
      },
      prohibitedItemsAccepted: details['prohibitedItemsAccepted'] == true,
    );
  }

  @override
  List<Object?> get props =>
      [recipientPhone, recipientName, itemDescription, size, declaredValue, prohibitedItemsAccepted];
}
