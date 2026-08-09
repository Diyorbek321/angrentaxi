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

  // Tariffs
  static const String tariffs = '/tariffs';

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
