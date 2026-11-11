import 'package:angren_taxi/core/config/app_config.dart';

/// Kirishda rol ilovaga mos kelmasa — nega.
enum WrongAppReason {
  /// Haydovchi raqami yo'lovchi ilovasida.
  driverInPassengerApp,

  /// Xodim/sotuvchi raqami ilova ruxsat bermaydigan joyda: admin — har
  /// ikkala ilovada, menejer/do'kon/restoran — haydovchi ilovasida.
  staffAccount,
}

/// Yo'lovchi ilovasiga kira oladigan rollar — backend
/// `PASSENGER_APP_ROLES` bilan bir xil. Menejer, do'kon va restoran egasi
/// ham taksi chaqiradi. Admin YO'Q: uning tokeni telefonda saqlanmasin.
const passengerAppRoles = {'passenger', 'manager', 'market', 'restaurant'};

/// Bitta raqam = bitta akkaunt = bitta rol (backend `users.role`), lekin
/// yo'lovchi ilovasidan bir nechta rol foydalanadi ([passengerAppRoles]).
///
/// ⚠️ NEGA ILOVADA HAM TEKSHIRILADI. Server noto'g'ri rolni baribir 403
/// bilan rad etadi, lekin kirish o'tib ketardi va foydalanuvchi buyurtma
/// bosgandagina inglizcha "Access denied. Required roles: passenger" ni
/// ko'rardi. Haydovchi ilovasida esa yo'lovchi raqami ariza ekraniga
/// tushadi — bu ATAYLAB ruxsat: ariza aynan yo'lovchi akkauntidan beriladi
/// (ariza ekranidagi ogohlantirishga qarang).
///
/// `null` rol (rolni saqlamagan juda eski sessiya) — o'tkaziladi: server
/// baribir o'zi tekshiradi, foydalanuvchini sababsiz chiqarib yubormaymiz.
WrongAppReason? wrongAppReason(AppFlavor flavor, String? role) {
  if (role == null) return null;
  switch (flavor) {
    case AppFlavor.passenger:
      if (passengerAppRoles.contains(role)) return null;
      return role == 'driver'
          ? WrongAppReason.driverInPassengerApp
          : WrongAppReason.staffAccount;
    case AppFlavor.driver:
      if (role == 'driver' || role == 'passenger') return null;
      return WrongAppReason.staffAccount;
  }
}
