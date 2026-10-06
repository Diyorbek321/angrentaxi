import 'package:angren_taxi/core/config/app_config.dart';

/// Kirishda rol ilovaga mos kelmasa — nega.
enum WrongAppReason {
  /// Haydovchi raqami yo'lovchi ilovasida.
  driverInPassengerApp,

  /// Xodim/sotuvchi raqami (admin, menejer, do'kon, restoran) mobil ilovada.
  staffAccount,
}

/// Bitta raqam = bitta akkaunt = bitta rol (backend `users.role`).
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
      if (role == 'passenger') return null;
      return role == 'driver'
          ? WrongAppReason.driverInPassengerApp
          : WrongAppReason.staffAccount;
    case AppFlavor.driver:
      if (role == 'driver' || role == 'passenger') return null;
      return WrongAppReason.staffAccount;
  }
}
