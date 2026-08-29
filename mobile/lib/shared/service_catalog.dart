import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/material.dart';

// ============================================================================
// XIZMAT KATALOGI — YO'LOVCHI TOMONI.
//
// ⚠️ NEGA `DriverServiceWording` DAN AJRATILGAN.
// Haydovchi fayli (`features/driver/service_wording.dart`) xizmatni
// HAYDOVCHINING ISHI sifatida ataydi: "Yuk tashish", "Ovqat yetkazish",
// "Market yetkazish". Bu o'sha ekranlarda to'g'ri — haydovchi aynan shu
// ishni bajaradi.
//
// Yo'lovchi esa xizmatni SOTIB OLADI, bajarmaydi. Uning uchun yorliq
// qisqa va iste'molchi tilida bo'lishi kerak: "Yuk", "Ovqat", "Market".
// Ikkalasi bir xil emas va bir xil bo'lishi ham shart emas.
//
// Amaliy sabab ham bor: yorliqlar sheet tepasidagi GORIZONTAL chip
// qatorida turadi. "Ovqat yetkazish" "Ovqat" dan ikki barobar keng —
// to'rtta chip tor ekranga sig'masdi. O'zbekcha matn inglizchadan
// 15–25% uzun bo'lgani uchun bu yerda har bir belgi hisobga olinadi.
//
// ⚠️ NOMA'LUM TUR — TAKSI ZAXIRASI. `serviceType` enum emas, erkin satr
// (shared/models/order.dart izohiga qarang). Server kelajakda `pharmacy`
// yuborsa, eski APK yiqilmasligi kerak.
// ============================================================================

@immutable
class ServiceCatalogEntry {
  const ServiceCatalogEntry._({
    required this.serviceType,
    required this.label,
    required this.icon,
  });

  /// Backend yuboradigan xizmat turi (`order.serviceType` bilan bir xil).
  final String serviceType;

  /// Yo'lovchi ko'radigan QISQA yorliq — chip qatoriga mo'ljallangan.
  final String label;

  final IconData icon;

  static const ServiceCatalogEntry taxi = ServiceCatalogEntry._(
    serviceType: kServiceTypeTaxi,
    label: 'Taksi',
    icon: Icons.local_taxi_rounded,
  );

  static const ServiceCatalogEntry cargo = ServiceCatalogEntry._(
    serviceType: kServiceTypeCargo,
    label: 'Yuk',
    icon: Icons.local_shipping_rounded,
  );

  static const ServiceCatalogEntry food = ServiceCatalogEntry._(
    serviceType: kServiceTypeFood,
    label: 'Ovqat',
    icon: Icons.restaurant_rounded,
  );

  static const ServiceCatalogEntry market = ServiceCatalogEntry._(
    serviceType: kServiceTypeMarket,
    label: 'Market',
    icon: Icons.storefront_rounded,
  );

  /// Yo'lovchi bosh ekranidagi chiplar tartibi.
  ///
  /// Taksi BIRINCHI va sukut bo'yicha tanlangan — sessiyalarning katta
  /// qismi taksi, shuning uchun u boshqa uchtasi bilan teng huquqda emas.
  static const List<ServiceCatalogEntry> all = <ServiceCatalogEntry>[
    taxi,
    cargo,
    food,
    market,
  ];

  /// Noma'lum tur kelsa taksiga tushadi — hech qachon `null` qaytarmaydi.
  static ServiceCatalogEntry of(String serviceType) {
    for (final entry in all) {
      if (entry.serviceType == serviceType) return entry;
    }
    return taxi;
  }
}
