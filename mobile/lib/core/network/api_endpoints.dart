class ApiEndpoints {
  ApiEndpoints._();

  // Auth
  static const String sendOtp = '/auth/send-otp';
  static const String verifyOtp = '/auth/verify-otp';
  static const String refreshToken = '/auth/refresh';
  static const String logout = '/auth/logout';

  // User / Passenger
  static const String userProfile = '/users/profile';
  static const String updateProfile = '/users/profile';
  static const String paymentMethods = '/users/payment-methods';

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

  // Promo codes
  static const String validatePromo = '/promo-codes/validate';

  // FCM
  static const String registerFcmToken = '/notifications/register-token';

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
}
