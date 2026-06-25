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
  static const String driverProfile = '/drivers/profile';
  static const String driverGoOnline = '/drivers/online';
  static const String driverGoOffline = '/drivers/offline';
  static const String driverActiveOrder = '/drivers/active-order';
  static const String driverEarnings = '/drivers/earnings';
  static const String driverOrderHistory = '/drivers/orders/history';
  static String acceptOrder(String id) => '/drivers/orders/$id/accept';
  static String declineOrder(String id) => '/drivers/orders/$id/decline';
  static String arrivedAtPickup(String id) => '/drivers/orders/$id/arrived';
  static String startTrip(String id) => '/drivers/orders/$id/start';
  static String completeTrip(String id) => '/drivers/orders/$id/complete';
  static String updateLocation(String orderId) =>
      '/drivers/orders/$orderId/location';

  // Ratings
  static const String submitRating = '/ratings';

  // Promo codes
  static const String validatePromo = '/promo-codes/validate';

  // FCM
  static const String registerFcmToken = '/notifications/register-token';
}
