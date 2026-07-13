import 'package:equatable/equatable.dart';

/// Mirrors the backend's `PaymentInitiateResult`
/// (`backend/src/modules/payments/payment.interface.ts`): the hosted
/// checkout URL for whichever provider handled the request, plus the
/// provider's own transaction id.
class PaymentInitiateResult extends Equatable {
  const PaymentInitiateResult({
    required this.url,
    required this.id,
    required this.provider,
  });

  factory PaymentInitiateResult.fromJson(Map<String, dynamic> json) {
    return PaymentInitiateResult(
      url: json['url'] as String,
      id: json['id'] as String,
      provider: json['provider'] as String? ?? 'payme',
    );
  }

  /// Hosted checkout page to open (Payme/Click/Uzcard).
  final String url;

  /// Provider-side transaction id.
  final String id;

  /// Which provider handled the request: 'payme' | 'click' | 'uzcard'.
  final String provider;

  @override
  List<Object?> get props => [url, id, provider];
}
