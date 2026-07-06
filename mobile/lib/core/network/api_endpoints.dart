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
  static const String estimatePrice = '/orders/estimate';
  static const String createOrder = '/orders';
  static const String orderHistory = '/orders/history';
  static String orderById(String id) => '/orders/$id';
  static String cancelOrder(String id) => '/orders/$id/cancel';

  // Tariffs
  static const String tariffs = '/tariffs';

  // Driver
  static const String driverProfile = '/drivers/me';
  static const String driverStatus = '/drivers/status';
  static const String driverEarnings = '/orders/earnings';
  static const String driverOrderHistory = '/orders/history';
  static String acceptOrder(String id) => '/orders/$id/accept';
  static String declineOrder(String id) => '/orders/$id/decline';
  static String arrivedAtPickup(String id) => '/orders/$id/arrived';
  static String startTrip(String id) => '/orders/$id/start';
  static String completeTrip(String id) => '/orders/$id/complete';
  static const String updateLocation = '/drivers/location';

  // Ratings
  static const String submitRating = '/ratings';

  // Promo codes
  static const String validatePromo = '/promo-codes/validate';

  // FCM
  static const String registerFcmToken = '/notifications/register-token';

  // Support chat
  static const String supportThreadMe = '/support/threads/me';
  static String supportThreadMessages(String id) =>
      '/support/threads/$id/messages';
  static String markSupportThreadRead(String id) => '/support/threads/$id/read';
}
