import 'package:angren_taxi/l10n/l10n.dart';
import 'package:angren_taxi/shared/models/order.dart';
import 'package:flutter/material.dart';

// ============================================================================
// HAYDOVCHI EKRANLARIDAGI MATN — XIZMAT TURIGA QARAB.
//
// ⚠️ NEGA BITTA FAYL. Haydovchi oqimi taksiga qurilgan edi: "Yo'lovchi",
// "Yo'lovchi bilan yozishish", "Safarni boshlash". Ovqat buyurtmasida esa
// olish nuqtasi RESTORAN, market'da DO'KON — bir xil ekranlar, boshqa
// so'zlar. Agar bu so'zlar ekranlarga sochilsa, har yangi vertikal
// qo'shilganda beshta faylni qidirib chiqish kerak bo'ladi va bittasi
// albatta unutiladi.
//
// Shuning uchun: ekranlar HECH QANDAY xizmatga oid matn saqlamaydi, faqat
// `DriverServiceWording.of(order.serviceType)` dan o'qiydi.
//
// ⚠️ NOMA'LUM TUR — TAKSI ZAXIRASI. Server kelajakda `pharmacy` yuborsa,
// eski APK yiqilmasligi kerak: matn taksi variantiga tushadi, ilova esa
// ishlashda davom etadi. Shu sababli bu yerda `switch` ustidan
// to'liqlik (exhaustiveness) talab qilinmaydi — `serviceType` enum emas,
// erkin satr (shared/models/order.dart dagi izohga qarang).
// ============================================================================

@immutable
class DriverServiceWording {
  const DriverServiceWording._({
    required this.serviceType,
    required this.icon,
  });

  /// Qaysi turga tegishli — testlar va tuzatish uchun.
  final String serviceType;

  /// Tur ikonasi. Yolg'iz ma'no tashimaydi — yonida doim [typeLabel] turadi.
  final IconData icon;

  // Matnlar joriy tildan o'qiladi (AppL10n.current) — shuning uchun
  // maydon emas, getter. Ommaviy nomlar o'zgarmagan.

  static AppLocalizations get _l => AppL10n.current;

  String _pick({
    required String taxi,
    required String cargo,
    required String food,
    required String market,
  }) =>
      switch (serviceType) {
        kServiceTypeCargo => cargo,
        kServiceTypeFood => food,
        kServiceTypeMarket => market,
        _ => taxi,
      };

  /// Buyurtma turining nomi ("Taksi", "Ovqat yetkazish"). Taklif ekranida
  /// haydovchi NIMA qabul qilayotganini shu yorliq aytadi.
  String get typeLabel => _pick(
        taxi: _l.drvTypeTaxi,
        cargo: _l.drvTypeCargo,
        food: _l.drvTypeFood,
        market: _l.drvTypeMarket,
      );

  /// Olish nuqtasidagi tomon: "Yo'lovchi" · "Yuk" · "Restoran" · "Do'kon".
  String get subject => _pick(
        taxi: _l.drvPassenger,
        cargo: _l.drvCargo,
        food: _l.drvRestaurant,
        market: _l.drvShop,
      );

  /// Yetkazish tomonidagi odam. Taksida u yo'lovchining o'zi, qolgan
  /// turlarda esa buyurtma bergan mijoz.
  String get clientLabel => _pick(
        taxi: _l.drvPassenger,
        cargo: _l.drvCustomer,
        food: _l.drvCustomer,
        market: _l.drvCustomer,
      );

  /// Chat tugmasining ekran o'quvchi uchun yorlig'i.
  String get chatLabel => _pick(
        taxi: _l.drvChatPassenger,
        cargo: _l.drvChatCustomer,
        food: _l.drvChatCustomer,
        market: _l.drvChatCustomer,
      );

  /// Olish nuqtasi sarlavhasi.
  String get pickupTitle => _pick(
        taxi: _l.drvPickupPlace,
        cargo: _l.drvCargoPickupPlace,
        food: _l.drvRestaurant,
        market: _l.drvShop,
      );

  /// Tushish nuqtasi sarlavhasi.
  String get dropoffTitle => _pick(
        taxi: _l.drvDestination,
        cargo: _l.drvDeliveryAddress,
        food: _l.drvDeliveryAddress,
        market: _l.drvDeliveryAddress,
      );

  /// Navigatsiya ekranining sarlavhasi ("Restoranga yo'l").
  String get routeHeader => _pick(
        taxi: _l.drvRouteToPassenger,
        cargo: _l.drvRouteToCargo,
        food: _l.drvRouteToRestaurant,
        market: _l.drvRouteToShop,
      );

  /// Masofa qatorining boshi: "$distanceToPickupLabel: 1,2 km".
  String get distanceToPickupLabel => _pick(
        taxi: _l.drvDistanceToPassenger,
        cargo: _l.drvDistanceToCargo,
        food: _l.drvDistanceToRestaurant,
        market: _l.drvDistanceToShop,
      );

  /// "Yetib keldim" ekranining bannerdagi sarlavhasi.
  String get arrivedTitle => _pick(
        taxi: _l.drvArrivedTaxi,
        cargo: _l.drvArrivedCargo,
        food: _l.drvArrivedRestaurant,
        market: _l.drvArrivedShop,
      );

  /// Olish nuqtasida bajariladigan ish ("Buyurtmani oling").
  String get pickupActionLabel => _pick(
        taxi: _l.drvPickupPassenger,
        cargo: _l.drvPickupCargo,
        food: _l.drvPickupOrder,
        market: _l.drvPickupOrder,
      );

  /// Safar/yetkazishni boshlash tugmasi.
  String get startActionLabel => _pick(
        taxi: _l.drvStartTrip,
        cargo: _l.drvStartDelivery,
        food: _l.drvStartDelivery,
        market: _l.drvStartDelivery,
      );

  /// Safar davom etayotgandagi yuqori panel matni.
  String get activeTitle => _pick(
        taxi: _l.drvTripInProgress,
        cargo: _l.drvCargoInProgress,
        food: _l.drvOrderInProgress,
        market: _l.drvOrderInProgress,
      );

  /// Yakunlash tugmasi.
  String get completeActionLabel => _pick(
        taxi: _l.drvCompleteTrip,
        cargo: _l.drvCompleteDelivery,
        food: _l.drvCompleteDelivery,
        market: _l.drvCompleteDelivery,
      );

  /// Yakunlashni tasdiqlash oynasining sarlavhasi va matni.
  String get completeConfirmTitle => completeActionLabel;
  String get completeConfirmBody => _pick(
        taxi: _l.drvCompleteTripConfirm,
        cargo: _l.drvCompleteCargoConfirm,
        food: _l.drvCompleteOrderConfirm,
        market: _l.drvCompleteOrderConfirm,
      );

  /// Yakunlangandan keyingi xabar.
  String get completeSuccessMessage => _pick(
        taxi: _l.drvTripCompleted,
        cargo: _l.drvCargoDelivered,
        food: _l.drvOrderDelivered,
        market: _l.drvOrderDelivered,
      );

  /// Olish nuqtasida hech narsa berilmagan holat ("Yo'lovchi kelmadi").
  String get noShowActionLabel => _pick(
        taxi: _l.drvPassengerNoShow,
        cargo: _l.drvCargoNotGiven,
        food: _l.drvOrderNotGiven,
        market: _l.drvOrderNotGiven,
      );

  static const DriverServiceWording taxi = DriverServiceWording._(
    serviceType: kServiceTypeTaxi,
    icon: Icons.local_taxi,
  );

  static const DriverServiceWording cargo = DriverServiceWording._(
    serviceType: kServiceTypeCargo,
    icon: Icons.local_shipping_rounded,
  );

  static const DriverServiceWording food = DriverServiceWording._(
    serviceType: kServiceTypeFood,
    icon: Icons.restaurant_rounded,
  );

  static const DriverServiceWording market = DriverServiceWording._(
    serviceType: kServiceTypeMarket,
    icon: Icons.storefront_rounded,
  );

  /// Tanish turmi — noma'lum bo'lsa `null`.
  ///
  /// Buyurtma oqimida bu kerak emas ([of] baribir taksiga qaytadi), lekin
  /// xizmat tanlash ekranida kerak: u yerdagi ro'yxat butunlay serverdan
  /// keladi va noma'lum turga TAKSI ikonasini qo'yish yolg'on bo'lardi.
  static DriverServiceWording? lookup(String? serviceType) {
    switch (serviceTypeFromApi(serviceType)) {
      case kServiceTypeTaxi:
        return taxi;
      case kServiceTypeCargo:
        return cargo;
      case kServiceTypeFood:
        return food;
      case kServiceTypeMarket:
        return market;
      default:
        return null;
    }
  }

  /// Xizmat turi bo'yicha matnlar to'plami.
  ///
  /// ⚠️ Noma'lum yoki bo'sh qiymat → [taxi]. Ilova hech qachon "bunday tur
  /// yo'q" deb yiqilmaydi: eng yomon holatda haydovchi taksi so'zlarini
  /// ko'radi, lekin buyurtma oqimi ishlab turaveradi.
  static DriverServiceWording of(String? serviceType) =>
      lookup(serviceType) ?? taxi;
}

/// Ekranlarda `DriverServiceWording.of(order.serviceType)` ni takrorlamaslik
/// uchun qisqa yo'l.
extension OrderServiceWording on Order {
  DriverServiceWording get wording => DriverServiceWording.of(serviceType);
}
