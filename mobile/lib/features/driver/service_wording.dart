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
    required this.typeLabel,
    required this.icon,
    required this.subject,
    required this.clientLabel,
    required this.chatLabel,
    required this.pickupTitle,
    required this.dropoffTitle,
    required this.routeHeader,
    required this.distanceToPickupLabel,
    required this.arrivedTitle,
    required this.pickupActionLabel,
    required this.startActionLabel,
    required this.activeTitle,
    required this.completeActionLabel,
    required this.completeConfirmTitle,
    required this.completeConfirmBody,
    required this.completeSuccessMessage,
    required this.noShowActionLabel,
  });

  /// Qaysi turga tegishli — testlar va tuzatish uchun.
  final String serviceType;

  /// Buyurtma turining nomi ("Taksi", "Ovqat yetkazish"). Taklif ekranida
  /// haydovchi NIMA qabul qilayotganini shu yorliq aytadi.
  final String typeLabel;

  /// Tur ikonasi. Yolg'iz ma'no tashimaydi — yonida doim [typeLabel] turadi.
  final IconData icon;

  /// Olish nuqtasidagi tomon: "Yo'lovchi" · "Yuk" · "Restoran" · "Do'kon".
  final String subject;

  /// Yetkazish tomonidagi odam. Taksida u yo'lovchining o'zi, qolgan
  /// turlarda esa buyurtma bergan mijoz.
  final String clientLabel;

  /// Chat tugmasining ekran o'quvchi uchun yorlig'i.
  final String chatLabel;

  /// Olish nuqtasi sarlavhasi.
  final String pickupTitle;

  /// Tushish nuqtasi sarlavhasi.
  final String dropoffTitle;

  /// Navigatsiya ekranining sarlavhasi ("Restoranga yo'l").
  final String routeHeader;

  /// Masofa qatorining boshi: "$distanceToPickupLabel: 1,2 km".
  final String distanceToPickupLabel;

  /// "Yetib keldim" ekranining bannerdagi sarlavhasi.
  final String arrivedTitle;

  /// Olish nuqtasida bajariladigan ish ("Buyurtmani oling").
  final String pickupActionLabel;

  /// Safar/yetkazishni boshlash tugmasi.
  final String startActionLabel;

  /// Safar davom etayotgandagi yuqori panel matni.
  final String activeTitle;

  /// Yakunlash tugmasi.
  final String completeActionLabel;

  /// Yakunlashni tasdiqlash oynasining sarlavhasi va matni.
  final String completeConfirmTitle;
  final String completeConfirmBody;

  /// Yakunlangandan keyingi xabar.
  final String completeSuccessMessage;

  /// Olish nuqtasida hech narsa berilmagan holat ("Yo'lovchi kelmadi").
  final String noShowActionLabel;

  static const DriverServiceWording taxi = DriverServiceWording._(
    serviceType: kServiceTypeTaxi,
    typeLabel: 'Taksi',
    icon: Icons.local_taxi,
    subject: "Yo'lovchi",
    clientLabel: "Yo'lovchi",
    chatLabel: "Yo'lovchi bilan yozishish",
    pickupTitle: 'Olish joyi',
    dropoffTitle: 'Manzil',
    routeHeader: "Yo'lovchiga yo'l",
    distanceToPickupLabel: "Yo'lovchigacha",
    arrivedTitle: 'Olish joyida turibsiz!',
    pickupActionLabel: "Yo'lovchini oling",
    startActionLabel: 'Safarni boshlash',
    activeTitle: 'Safar davom etmoqda',
    completeActionLabel: 'Safarni yakunlash',
    completeConfirmTitle: 'Safarni yakunlash',
    completeConfirmBody: 'Safarni yakunlashni tasdiqlaysizmi?',
    completeSuccessMessage: 'Safar muvaffaqiyatli yakunlandi!',
    noShowActionLabel: "Yo'lovchi kelmadi",
  );

  static const DriverServiceWording cargo = DriverServiceWording._(
    serviceType: kServiceTypeCargo,
    typeLabel: 'Yuk tashish',
    icon: Icons.local_shipping_rounded,
    subject: 'Yuk',
    clientLabel: 'Mijoz',
    chatLabel: 'Mijoz bilan yozishish',
    pickupTitle: 'Yukni olish joyi',
    dropoffTitle: 'Yetkazish manzili',
    routeHeader: "Yukka yo'l",
    distanceToPickupLabel: 'Yukkacha',
    arrivedTitle: 'Yuk olish joyidasiz!',
    pickupActionLabel: 'Yukni oling',
    startActionLabel: 'Yetkazishni boshlash',
    activeTitle: 'Yuk yetkazilmoqda',
    completeActionLabel: 'Yetkazishni yakunlash',
    completeConfirmTitle: 'Yetkazishni yakunlash',
    completeConfirmBody: 'Yukni topshirganingizni tasdiqlaysizmi?',
    completeSuccessMessage: 'Yuk muvaffaqiyatli yetkazildi!',
    noShowActionLabel: 'Yuk berilmadi',
  );

  static const DriverServiceWording food = DriverServiceWording._(
    serviceType: kServiceTypeFood,
    typeLabel: 'Ovqat yetkazish',
    icon: Icons.restaurant_rounded,
    subject: 'Restoran',
    clientLabel: 'Mijoz',
    chatLabel: 'Mijoz bilan yozishish',
    pickupTitle: 'Restoran',
    dropoffTitle: 'Yetkazish manzili',
    routeHeader: "Restoranga yo'l",
    distanceToPickupLabel: 'Restorangacha',
    arrivedTitle: 'Restorandasiz!',
    pickupActionLabel: 'Buyurtmani oling',
    startActionLabel: 'Yetkazishni boshlash',
    activeTitle: 'Buyurtma yetkazilmoqda',
    completeActionLabel: 'Yetkazishni yakunlash',
    completeConfirmTitle: 'Yetkazishni yakunlash',
    completeConfirmBody: 'Buyurtmani mijozga topshirganingizni tasdiqlaysizmi?',
    completeSuccessMessage: 'Buyurtma muvaffaqiyatli yetkazildi!',
    noShowActionLabel: 'Buyurtma berilmadi',
  );

  static const DriverServiceWording market = DriverServiceWording._(
    serviceType: kServiceTypeMarket,
    typeLabel: 'Market yetkazish',
    icon: Icons.storefront_rounded,
    subject: "Do'kon",
    clientLabel: 'Mijoz',
    chatLabel: 'Mijoz bilan yozishish',
    pickupTitle: "Do'kon",
    dropoffTitle: 'Yetkazish manzili',
    routeHeader: "Do'konga yo'l",
    distanceToPickupLabel: "Do'kongacha",
    arrivedTitle: "Do'kondasiz!",
    pickupActionLabel: 'Buyurtmani oling',
    startActionLabel: 'Yetkazishni boshlash',
    activeTitle: 'Buyurtma yetkazilmoqda',
    completeActionLabel: 'Yetkazishni yakunlash',
    completeConfirmTitle: 'Yetkazishni yakunlash',
    completeConfirmBody: 'Buyurtmani mijozga topshirganingizni tasdiqlaysizmi?',
    completeSuccessMessage: 'Buyurtma muvaffaqiyatli yetkazildi!',
    noShowActionLabel: 'Buyurtma berilmadi',
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
