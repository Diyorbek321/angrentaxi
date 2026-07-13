import 'package:angren_taxi/shared/models/payment_initiate_result.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

/// Signature used to open the hosted checkout page after
/// `POST /payments/initiate` succeeds. Returns true if the user confirmed
/// they finished paying, false/null if they cancelled/backed out. Overridable
/// in widget tests so they don't need a real webview_flutter platform
/// implementation.
typedef OpenPaymentCheckout = Future<bool?> Function(
  BuildContext context,
  PaymentInitiateResult result,
);

/// Hosts the real Payme/Click/Uzcard checkout page returned by
/// `POST /payments/initiate` inside the app, so the passenger never has to
/// leave Angren Taxi to pay.
///
/// This screen only renders whatever hosted page the provider returns — it
/// does not itself move money. Whether a completed checkout on that page
/// actually clears funds depends on the merchant credentials configured for
/// that provider on the backend (see the doc comment on [PaymentService]).
///
/// There's no universal, provider-agnostic way to detect "payment succeeded"
/// purely from client-side navigation events (each provider's hosted flow
/// redirects differently), so this screen keeps that decision explicit and
/// user-driven: a persistent bottom bar lets the passenger confirm once
/// they've finished on the provider's page, or cancel. The real source of
/// truth is still the provider's server-to-server callback
/// (`/payments/{payme,click,uzcard}/callback`), which updates the
/// transaction row backing `GET /payments/wallet` /
/// `GET /payments/transactions` independently of what this screen reports.
class PaymentWebViewScreen extends StatefulWidget {
  const PaymentWebViewScreen({super.key, required this.result});

  final PaymentInitiateResult result;

  @override
  State<PaymentWebViewScreen> createState() => _PaymentWebViewScreenState();
}

class _PaymentWebViewScreenState extends State<PaymentWebViewScreen> {
  late final WebViewController _controller;
  bool _loading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (_) => setState(() => _loading = true),
          onPageFinished: (_) => setState(() => _loading = false),
          onWebResourceError: (error) => setState(() {
            _loading = false;
            _loadError = error.description;
          }),
        ),
      )
      ..loadRequest(Uri.parse(widget.result.url));
  }

  void _finish(bool completed) {
    if (!mounted) return;
    Navigator.of(context).pop(completed);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _finish(false);
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text("To'lov — ${widget.result.provider.toUpperCase()}"),
          leading: IconButton(
            icon: const Icon(Icons.close_rounded),
            onPressed: () => _finish(false),
          ),
        ),
        body: Column(
          children: [
            if (_loading) const LinearProgressIndicator(minHeight: 2),
            Expanded(
              child: _loadError != null
                  ? _ErrorState(
                      message: _loadError!,
                      onRetry: () {
                        setState(() => _loadError = null);
                        _controller.loadRequest(Uri.parse(widget.result.url));
                      },
                    )
                  : WebViewWidget(controller: _controller),
            ),
            SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => _finish(false),
                        child: const Text('Bekor qilish'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => _finish(true),
                        child: const Text("To'ladim"),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_off_rounded, size: 40, color: Colors.grey),
            const SizedBox(height: 12),
            Text(
              "To'lov sahifasini yuklab bo'lmadi: $message",
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            OutlinedButton(onPressed: onRetry, child: const Text('Qayta urinish')),
          ],
        ),
      ),
    );
  }
}
