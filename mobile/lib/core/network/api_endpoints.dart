class ApiEndpoints {
  ApiEndpoints._();

  // Auth
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String refreshToken = '/auth/refresh';
  static const String logout = '/auth/logout';

  // User / Passenger
  // Backend route is GET/PATCH /users/me (users.controller.ts) — was
  // '/users/profile', which doesn't exist and was never actually called
  // from anywhere until the profile-edit screen below started using it.
  static const String userProfile = '/users/me';
  static const String updateProfile = '/users/me';
  static const String paymentMethods = '/users/payment-methods';

  // Favorite addresses (passenger)
  static const String favoriteAddresses = '/users/favorite-addresses';
  static String favoriteAddressById(String id) =>
      '/users/favorite-addresses/$id';

  // Orders (Passenger)
  // Backend route is POST /orders/calculate-price, taking
  // {tariffId, distanceKm, durationMin} — see
  // backend/src/modules/orders/dto/calculate-price.dto.ts. Was previously
  // '/orders/estimate' with a lat/lng body, which 404'd against the real API.
  static const String estimatePrice = '/orders/calculate-price';
  static const String createOrder = '/orders';
  static const String orderHistory = '/orders/history';
  static String orderById(String id) => '/orders/$id';
  static String cancelOrder(String id) => '/orders/$id/cancel';

  // GET /orders/scheduled (orders.controller.ts) — yo'lovchining kelgusi
  // rejalashtirilgan safarlari, eng yaqini birinchi.
  //
  // ⚠️ Backend'da bu marshrut `@Get(':id')` DAN OLDIN e'lon qilingan
  // bo'lishi shart, aks holda Nest 'scheduled' ni UUID deb o'qib
  // `ParseUUIDPipe` bilan 400 qaytaradi.
  //
  // Bekor qilish uchun alohida endpoint YO'Q — rejalashtirilgan buyurtma
  // mavjud `cancelOrder` orqali bekor qilinadi (backend'da SCHEDULED
  // bekor qilinadigan holatlar ro'yxatiga qo'shilgan).
  static const String scheduledOrders = '/orders/scheduled';

  // GET /orders/:id/receipt (orders.controller.ts) — TUGAGAN safarning
  // moliyaviy hujjati: narx tarkibi, chegirma, chaqim, to'lov holati.
  // Safar tugamagan bo'lsa 400, chek boshqaning bo'lsa 403 qaytadi.
  static String orderReceipt(String id) => '/orders/$id/receipt';

  // Chaqim — POST /orders/:id/tip (orders.controller.ts). Faqat yo'lovchi
  // roli, faqat TUGAGAN safar uchun va safar tugaganidan keyingi 24 soat
  // ichida. Tana: {amount} — 1 000..200 000 oralig'idagi BUTUN son
  // (add-tip.dto.ts), javob: {tipAmount, walletBalance}.
  //
  // ⚠️ Summa faqat HAMYONDAN yechiladi — naqd/karta yo'q, chunki chaqim
  // DEBIT qatori yo'l haqi DEBIT qatorini to'sib qo'yardi
  // (orders-tips.service.ts dagi izohga qarang).
  static String addTip(String id) => '/orders/$id/tip';

  // Tariffs
  static const String tariffs = '/tariffs';

  // Xizmat ko'rsatiladigan shaharlar — OMMAVIY marshrut (token talab
  // qilmaydi), chunki qamrov buyurtmadan OLDIN kerak.
  //
  //   GET /cities → [{id, name, centerLat, centerLng, radiusKm}]
  //
  // Har bir shahar MARKAZ + RADIUS bilan berilgan doira. Ro'yxat bo'sh
  // kelsa yoki so'rov yiqilsa mobil tomon hech narsani bloklamaydi —
  // core/location/city_coverage.dart dagi izohga qarang.
  static const String cities = '/cities';

  // Driver
  static const String driverProfile = '/drivers/me';
  static const String driverApply = '/drivers/profile';
  static const String driverStatus = '/drivers/status';
  static const String driverEarnings = '/orders/earnings';
  // GET /orders/earnings/breakdown (orders.controller.ts) — today/week/month
  // gross/commission/net/trips for the calling driver. Distinct from
  // `driverEarnings` above (which still only returns `{ today: number }`
  // and is kept for the existing headline figure).
  static const String driverEarningsBreakdown = '/orders/earnings/breakdown';
  static const String driverOrderHistory = '/orders/history';
  static String acceptOrder(String id) => '/orders/$id/accept';
  static String declineOrder(String id) => '/orders/$id/decline';
  static String arrivedAtPickup(String id) => '/orders/$id/arrived';
  static String startTrip(String id) => '/orders/$id/start';
  static String completeTrip(String id) => '/orders/$id/complete';
  static const String updateLocation = '/drivers/location';
  static const String driverDocuments = '/drivers/documents';

  // Haydovchi tekshiruvi — hujjat muddatlari + avtomobil suratlari.
  //
  // ⚠️ Talablar RO'YXATI SERVERDAN keladi: `code` erkin satr, `label`/`hint`
  // ni ham server beradi. Mobil tomonda qattiq kodlangan ro'yxat YO'Q —
  // yangi talab qo'shish uchun APK chiqarish SHART EMAS. To'liq kontrakt
  // uchun shared/models/driver_verification.dart ga qarang.
  static const String driverVerification = '/drivers/me/verification';

  // POST, multipart/form-data, maydon nomi "file". `code` serverdan kelgan
  // erkin satr bo'lgani uchun manzilga qo'yishdan oldin kodlanadi — unda
  // `/` yoki bo'sh joy chiqib qolsa marshrut buzilmasin.
  static String driverVerificationUpload(String code) =>
      '/drivers/me/verification/${Uri.encodeComponent(code)}';

  // Haydovchining XIZMAT TURLARI — qaysi vertikallardan buyurtma oladi.
  //
  //   GET   /drivers/me/services  → { enabled: [...], options: [...] }
  //   PATCH /drivers/me/services  ← { serviceTypes: ['taxi', 'food'] }
  //
  // ⚠️ Ro'yxat, nom va izoh SERVERDAN keladi — mobil tomonda tarjima
  // jadvali YO'Q (tekshiruv ekranidagi naqshning aynan o'zi). To'liq
  // kontrakt uchun shared/models/driver_service.dart ga qarang.
  static const String driverServices = '/drivers/me/services';

  // Talab (surge) xaritasi — faqat haydovchi roli uchun.
  // GET /surge/zones?lat=<double>&lng=<double>&rings=<int, default 4>
  // To'g'ridan-to'g'ri MapLibre'ga beriladigan GeoJSON `FeatureCollection`
  // qaytaradi; har bir feature `properties`ida `zone`, `level` va
  // `multiplier` bo'ladi (koeffitsiyent EKRANGA CHIQMAYDI — shared/models/
  // demand_zone.dart dagi izohga qarang).
  static const String surgeZones = '/surge/zones';

  // Ratings
  static const String submitRating = '/ratings';
  // GET /ratings/driver/:userId (ratings.controller.ts) — rating stats
  // (avg/count/star breakdown) for a driver, keyed by the driver's *User*
  // UUID (not the driver profile id).
  static String driverRatingStats(String userId) => '/ratings/driver/$userId';

  // Driver bonus program (backend/src/modules/driver-bonuses)
  static const String driverBonusProgress = '/driver-bonus-rules/me/progress';

  // Promo codes
  static const String validatePromo = '/promo-codes/validate';
  // GET /promo-codes/active (promo-codes.controller.ts) — currently-active,
  // usable promo codes (not expired, under maxUses), newest first. Any
  // authenticated user may call it.
  static const String activePromoCodes = '/promo-codes/active';

  // FCM
  static const String registerFcmToken = '/notifications/register-token';

  // Notification history (backend/src/modules/notifications) — persisted
  // NotificationLog rows, distinct from the FCM token route above.
  static const String notifications = '/notifications';
  static String markNotificationRead(String id) => '/notifications/$id/read';
  static const String markAllNotificationsRead = '/notifications/read-all';

  // Market (storefront)
  static const String marketStores = '/market/stores';
  static String marketStore(String id) => '/market/stores/$id';
  static const String marketOrders = '/market/orders';
  static String marketOrderById(String id) => '/market/orders/$id';

  // Food (storefront)
  static const String foodRestaurants = '/food/restaurants';
  static String foodRestaurant(String id) => '/food/restaurants/$id';
  static const String foodOrders = '/food/orders';
  static String foodOrderById(String id) => '/food/orders/$id';

  // Payments (Payme / Click / Uzcard online checkout)
  static const String paymentsInitiate = '/payments/initiate';
  static const String paymentsWallet = '/payments/wallet';

  /// Customer-facing platform settings (support phone, delivery fee).
  static const String settingsPublic = '/settings/public';
  static const String paymentsTransactions = '/payments/transactions';

  // Driver wallet withdrawals (payout requests)
  static const String walletWithdraw = '/payments/wallet/withdraw';
  static const String walletWithdrawals = '/payments/wallet/withdrawals';
  static String walletWithdrawalById(String id) =>
      '/payments/wallet/withdrawals/$id';

  // Support chat
  static const String supportThreadMe = '/support/threads/me';
  static String supportThreadMessages(String id) =>
      '/support/threads/$id/messages';
  static String markSupportThreadRead(String id) => '/support/threads/$id/read';

  // Trip chat (backend/src/modules/trip-chat) — passenger<->driver messaging
  // scoped to a single order.
  static String tripMessages(String orderId) => '/orders/$orderId/messages';

  // Referral program (backend/src/modules/referrals) — invite-a-friend
  // bonus. GET returns {referralCode, referredCount, totalBonusEarned}
  // scoped to the caller; POST applies another user's code to the caller's
  // account (one-time only).
  static const String myReferralInfo = '/users/me/referral';
  static const String applyReferralCode = '/users/me/referral/apply';

  // Safety / SOS (backend/src/modules/safety)
  static String reportSos(String orderId) => '/orders/$orderId/sos';
  static String resolveSos(String id) => '/sos/$id/resolve';
  static const String activeSosAlerts = '/sos/active';
}
