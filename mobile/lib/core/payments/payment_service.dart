import 'package:angren_taxi/core/network/api_client.dart';
import 'package:angren_taxi/core/network/api_endpoints.dart';
import 'package:angren_taxi/shared/models/payment_initiate_result.dart';

/// Which online provider should host the checkout page. Kept in sync with
/// `PaymentsController.initiatePayment`'s `provider` query param
/// (backend/src/modules/payments/payments.controller.ts).
enum OnlinePaymentProvider { payme, click, uzcard }

extension OnlinePaymentProviderWire on OnlinePaymentProvider {
  String get wireValue => switch (this) {
        OnlinePaymentProvider.payme => 'payme',
        OnlinePaymentProvider.click => 'click',
        OnlinePaymentProvider.uzcard => 'uzcard',
      };
}

/// Thrown when POST /payments/initiate fails — carries a user-facing message
/// already resolved via [extractErrorMessage].
class PaymentException implements Exception {
  PaymentException(this.message);
  final String message;

  @override
  String toString() => message;
}

/// Thin wrapper around `POST /payments/initiate`
/// (backend/src/modules/payments/payments.controller.ts +
/// payments.service.ts). Returns the hosted Payme/Click/Uzcard checkout URL
/// for a given order.
///
/// IMPORTANT — real backend business rule to be aware of when wiring this
/// into a new screen: `PaymentsService.initiatePayment` only accepts an id
/// from the taxi-ride `orders` table (see `database/entities/order.entity.ts`)
/// and only once that order's `status === OrderStatus.COMPLETED`. It does
/// **not** currently accept market/food order ids (those live in separate
/// `market_orders` / `food_orders` tables), and it will reject a
/// freshly-created taxi order with `400 Order must be completed before
/// payment`. Until the backend is extended, calls made from checkout-time
/// screens (market/food checkout, or right after creating a taxi order) will
/// surface as a normal [PaymentException] — which is expected, not a bug in
/// this client. The call itself, the URL it returns, and the checkout
/// WebView are fully functional for whatever order the backend does accept.
///
/// Also note: even once the order-id/status constraints are satisfied,
/// whether tapping through the Payme/Click/Uzcard page actually moves real
/// money depends entirely on which of those providers has live merchant
/// credentials configured on the backend (env vars consumed by
/// `payme.provider.ts` / `click.provider.ts` / `uzcard.provider.ts`). A
/// provider without real credentials will still return a checkout URL (or
/// fail depending on how that provider's SDK behaves without keys) but won't
/// clear real funds.
class PaymentService {
  PaymentService({required ApiClient apiClient}) : _apiClient = apiClient;

  final ApiClient _apiClient;

  Future<PaymentInitiateResult> initiate({
    required String orderId,
    OnlinePaymentProvider provider = OnlinePaymentProvider.payme,
  }) async {
    try {
      final response = await _apiClient.post(
        '${ApiEndpoints.paymentsInitiate}?provider=${provider.wireValue}',
        data: {
          'orderId': orderId,
          'method': 'card',
        },
      );
      final body = response.data as Map<String, dynamic>;
      final payload = (body['data'] ?? body) as Map<String, dynamic>;
      return PaymentInitiateResult.fromJson(payload);
    } catch (e) {
      throw PaymentException(extractErrorMessage(e));
    }
  }
}
